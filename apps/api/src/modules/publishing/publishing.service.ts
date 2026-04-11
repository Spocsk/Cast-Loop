import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { SocialProvider } from "@cast-loop/shared";
import { AppEnv } from "../../config/env";
import { SupabaseAdminService } from "../../database/supabase-admin.service";
import { TokenCipherService } from "../../common/crypto/token-cipher.service";
import { PostsService } from "../posts/posts.service";

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly tokenCipherService: TokenCipherService,
    private readonly supabaseAdminService: SupabaseAdminService,
    private readonly configService: ConfigService<AppEnv, true>
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
    const signedMediaUrl =
      payload.post.storageBucket && payload.post.storagePath
        ? await this.getSignedMediaUrl(payload.post.storageBucket, payload.post.storagePath)
        : null;

    const results = await Promise.all(
      payload.targets.map(async (target) => {
        if (target.status !== "pending") {
          return {
            postTargetId: target.id,
            success: true,
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
            mediaUrl: signedMediaUrl,
            metadata: target.metadata ?? {}
          });

          return {
            postTargetId: target.id,
            success: true,
            externalPostId: publishResult.externalPostId,
            responsePayload: publishResult.responsePayload
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown publishing error";
          this.logger.error(`Failed to publish ${postId} on ${target.provider}: ${message}`);
          return {
            postTargetId: target.id,
            success: false,
            errorMessage: message,
            responsePayload: {}
          };
        }
      })
    );

    await this.postsService.recordPublishResult(postId, results);
  }

  private async dispatchPublish(payload: {
    provider: SocialProvider;
    accessToken: string | null;
    title: string;
    content: string;
    mediaUrl: string | null;
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
          mediaUrl: payload.mediaUrl
        }
      };
    }

    if (!payload.accessToken) {
      throw new Error(`Missing access token for ${payload.provider}`);
    }

    throw new Error(`Live publishing for ${payload.provider} is not implemented yet`);
  }

  private async getSignedMediaUrl(bucket: string, path: string) {
    const { data, error } = await this.supabaseAdminService.client.storage.from(bucket).createSignedUrl(path, 900);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Unable to create signed media URL");
    }

    return data.signedUrl;
  }
}
