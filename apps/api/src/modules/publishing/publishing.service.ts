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
    let media: { buffer: Buffer; mimeType: string; fileName: string } | null = null;

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
            media: media ? { mimeType: media.mimeType } : null,
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
    media: { mimeType: string } | null;
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

    throw new Error(`Live publishing for ${payload.provider} is not implemented yet`);
  }

  private async sendTelegramReminder(
    payload: Awaited<ReturnType<PostsService["getPublishingPayload"]>>,
    connectOnlyTargets: Awaited<ReturnType<PostsService["getPublishingPayload"]>>["targets"],
    media: { buffer: Buffer; mimeType: string; fileName: string } | null
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
}
