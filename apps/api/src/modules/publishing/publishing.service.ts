import { Buffer } from "node:buffer";
import { basename } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { SocialProvider } from "@cast-loop/shared";
import { AppEnv } from "../../config/env";
import { SupabaseAdminService } from "../../database/supabase-admin.service";
import { TokenCipherService } from "../../common/crypto/token-cipher.service";
import { PostsService } from "../posts/posts.service";
import { TelegramNotifierService } from "./telegram-notifier.service";

interface DownloadedMediaFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly tokenCipherService: TokenCipherService,
    private readonly supabaseAdminService: SupabaseAdminService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly telegramNotifierService: TelegramNotifierService
  ) {}

  @Cron("0 * * * * *")
  async handleScheduledPosts() {
    const postIds = await this.postsService.claimDuePosts(10);

    for (const postId of postIds) {
      await this.publishPost(postId);
    }
  }

  async publishPost(postId: string) {
    const payload = await this.postsService.getPublishingPayload(postId);
    let media: DownloadedMediaFile | null = null;

    try {
      media =
        payload.post.storageBucket && payload.post.storagePath
          ? await this.getMediaFile(
              payload.post.storageBucket,
              payload.post.storagePath,
              payload.post.mimeType ?? "image/jpeg"
            )
          : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read media";
      const results = payload.targets
        .filter((target) => target.status === "pending")
        .map((target) => ({
          postTargetId: target.id,
          success: false,
          targetStatus: "failed" as const,
          errorMessage: message,
          responsePayload: {}
        }));

      await this.postsService.recordPublishResult(postId, results);
      return;
    }
    const publishableTargets = payload.targets.filter((target) => target.publishCapability === "publishable");
    const connectOnlyTargets = payload.targets.filter((target) => target.publishCapability === "connect_only");

    const publishableResults = await Promise.all(
      publishableTargets.map(async (target) => {
        if (target.status !== "pending") {
          return {
            postTargetId: target.id,
            success: true,
            targetStatus: target.status,
            externalPostId: `already-processed-${target.id}`,
            responsePayload: { skipped: true }
          };
        }

        try {
          const accessToken = target.accessTokenEncrypted
            ? this.tokenCipherService.decrypt(target.accessTokenEncrypted)
            : null;
          const publishResult = await this.dispatchPublish({
            provider: target.provider,
            accessToken,
            content: payload.post.content,
            title: payload.post.title,
            media,
            metadata: target.metadata ?? {}
          });

          return {
            postTargetId: target.id,
            success: true,
            targetStatus: "published" as const,
            externalPostId: publishResult.externalPostId,
            responsePayload: publishResult.responsePayload
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown publishing error";
          this.logger.error(`Failed to publish ${postId} on ${target.provider}: ${message}`);
          return {
            postTargetId: target.id,
            success: false,
            targetStatus: "failed" as const,
            errorMessage: message,
            responsePayload: {}
          };
        }
      })
    );

    const connectOnlyResults =
      connectOnlyTargets.length === 0
        ? []
        : await this.sendTelegramReminder(payload, connectOnlyTargets, media);

    await this.postsService.recordPublishResult(postId, [...publishableResults, ...connectOnlyResults]);
  }

  private async dispatchPublish(payload: {
    provider: SocialProvider;
    accessToken: string | null;
    title: string;
    content: string;
    media: DownloadedMediaFile | null;
    metadata: Record<string, unknown>;
  }) {
    const mode = this.configService.get("socialPublishMode", { infer: true });

    if (mode === "mock") {
      return {
        externalPostId: `${payload.provider}-${Date.now()}`,
        responsePayload: {
          mode,
          title: payload.title,
          contentLength: payload.content.length,
          hasMedia: Boolean(payload.media)
        }
      };
    }

    if (!payload.accessToken) {
      throw new Error(`Missing access token for ${payload.provider}`);
    }

    if (payload.provider === "linkedin") {
      return this.publishLinkedInPost({
        accessToken: payload.accessToken,
        title: payload.title,
        content: payload.content,
        media: payload.media,
        metadata: payload.metadata
      });
    }

    throw new Error(`Live publishing for ${payload.provider} is not implemented yet`);
  }

  private async sendTelegramReminder(
    payload: Awaited<ReturnType<PostsService["getPublishingPayload"]>>,
    connectOnlyTargets: Awaited<ReturnType<PostsService["getPublishingPayload"]>>["targets"],
    media: DownloadedMediaFile | null
  ) {
    if (!payload.post.sendTelegramReminder) {
      return connectOnlyTargets.map((target) => ({
        postTargetId: target.id,
        success: false,
        targetStatus: "failed" as const,
        errorMessage: "Telegram reminder is not enabled for this post",
        responsePayload: {}
      }));
    }

    try {
      const telegramResponse = await this.telegramNotifierService.sendReminder({
        title: payload.post.title,
        content: payload.post.content,
        scheduledAt: payload.post.scheduledAt ?? new Date().toISOString(),
        targets: connectOnlyTargets.map((target) => ({
          provider: target.provider,
          displayName: target.displayName,
          handle: target.handle
        })),
        image: media
      });

      return connectOnlyTargets.map((target) => ({
        postTargetId: target.id,
        success: true,
        targetStatus: "notified" as const,
        externalPostId: typeof telegramResponse === "object" ? `telegram-${Date.now()}` : undefined,
        responsePayload: {
          deliveryChannel: "telegram"
        }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown telegram error";
      this.logger.error(`Failed to send Telegram reminder for ${payload.post.id}: ${message}`);
      return connectOnlyTargets.map((target) => ({
        postTargetId: target.id,
        success: false,
        targetStatus: "failed" as const,
        errorMessage: message,
        responsePayload: {
          deliveryChannel: "telegram"
        }
      }));
    }
  }

  private async getMediaFile(bucket: string, path: string, mimeType: string) {
    const { data, error } = await this.supabaseAdminService.client.storage.from(bucket).download(path);

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to download media");
    }

    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      mimeType,
      fileName: basename(path)
    };
  }

  private async publishLinkedInPost(payload: {
    accessToken: string;
    title: string;
    content: string;
    media: DownloadedMediaFile | null;
    metadata: Record<string, unknown>;
  }) {
    const authorUrn = this.resolveLinkedInAuthorUrn(payload.metadata);
    const imageUrn = payload.media
      ? await this.uploadLinkedInImage(payload.accessToken, authorUrn, payload.media)
      : null;

    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: this.buildLinkedInHeaders(payload.accessToken, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        author: authorUrn,
        commentary: payload.content,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        ...(imageUrn
          ? {
              content: {
                media: {
                  id: imageUrn,
                  altText: this.buildLinkedInAltText(payload.title, payload.content)
                }
              }
            }
          : {}),
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      })
    });

    if (!response.ok) {
      throw new Error(await this.readLinkedInError(response));
    }

    const externalPostId = response.headers.get("x-restli-id");

    return {
      externalPostId: externalPostId ?? `linkedin-${Date.now()}`,
      responsePayload: {
        mode: "live",
        author: authorUrn,
        imageUrn,
        hasMedia: Boolean(imageUrn)
      }
    };
  }

  private resolveLinkedInAuthorUrn(metadata: Record<string, unknown>) {
    const organizationUrn = this.readMetadataString(metadata, "linkedinOrganizationUrn");

    if (organizationUrn) {
      return organizationUrn;
    }

    const organizationId = this.readMetadataString(metadata, "linkedinOrganizationId");

    if (organizationId) {
      return `urn:li:organization:${organizationId}`;
    }

    const personUrn = this.readMetadataString(metadata, "linkedinPersonUrn");

    if (personUrn) {
      return personUrn;
    }

    const personId = this.readMetadataString(metadata, "linkedinPersonId");

    if (personId) {
      return `urn:li:person:${personId}`;
    }

    throw new Error("Missing LinkedIn author metadata");
  }

  private async uploadLinkedInImage(
    accessToken: string,
    ownerUrn: string,
    media: DownloadedMediaFile
  ) {
    if (!media.mimeType.startsWith("image/")) {
      throw new Error(`LinkedIn publishing only supports images for now (received ${media.mimeType})`);
    }

    const initializeResponse = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: this.buildLinkedInHeaders(accessToken, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: ownerUrn
        }
      })
    });

    if (!initializeResponse.ok) {
      throw new Error(await this.readLinkedInError(initializeResponse));
    }

    const initializePayload = (await initializeResponse.json()) as {
      value?: {
        uploadUrl?: string;
        image?: string;
      };
    };

    const uploadUrl = initializePayload.value?.uploadUrl;
    const imageUrn = initializePayload.value?.image;

    if (!uploadUrl || !imageUrn) {
      throw new Error("LinkedIn image upload initialization returned an incomplete response");
    }

    await this.uploadLinkedInBinary(uploadUrl, media);
    await this.waitForLinkedInImageAvailability(accessToken, imageUrn);

    return imageUrn;
  }

  private async uploadLinkedInBinary(uploadUrl: string, media: DownloadedMediaFile) {
    let lastErrorMessage = "Unable to upload image to LinkedIn";

    for (const method of ["PUT", "POST"] as const) {
      const response = await fetch(uploadUrl, {
        method,
        headers: {
          "Content-Type": media.mimeType,
          "Content-Length": String(media.buffer.byteLength)
        },
        body: new Uint8Array(media.buffer)
      });

      if (response.ok) {
        return;
      }

      lastErrorMessage = await this.readLinkedInError(response);

      if (response.status !== 405) {
        break;
      }
    }

    throw new Error(lastErrorMessage);
  }

  private async waitForLinkedInImageAvailability(accessToken: string, imageUrn: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`https://api.linkedin.com/rest/images/${encodeURIComponent(imageUrn)}`, {
        headers: this.buildLinkedInHeaders(accessToken)
      });

      if (!response.ok) {
        throw new Error(await this.readLinkedInError(response));
      }

      const payload = (await response.json()) as {
        status?: string;
      };

      if (payload.status === "AVAILABLE") {
        return;
      }

      await this.sleep(1000);
    }

    throw new Error(`LinkedIn image ${imageUrn} is not available yet`);
  }

  private buildLinkedInHeaders(accessToken: string, extraHeaders?: Record<string, string>) {
    const version = this.configService.get("linkedinApiVersion", { infer: true });

    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      ...(version ? { "LinkedIn-Version": version } : {}),
      ...(extraHeaders ?? {})
    };
  }

  private buildLinkedInAltText(title: string, content: string) {
    const candidate = title.trim() || content.trim();

    if (!candidate) {
      return "Image publiee depuis Cast Loop";
    }

    return candidate.slice(0, 4086);
  }

  private readMetadataString(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key];

    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  private async readLinkedInError(response: Response) {
    const text = await response.text();

    try {
      const payload = JSON.parse(text) as {
        message?: string;
        error?: string;
        error_description?: string;
      };

      return (
        payload.message ??
        payload.error_description ??
        payload.error ??
        (text || `LinkedIn request failed with status ${response.status}`)
      );
    } catch {
      return text || `LinkedIn request failed with status ${response.status}`;
    }
  }

  private sleep(durationMs: number) {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}
