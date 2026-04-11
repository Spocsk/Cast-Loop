import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PostState } from "@cast-loop/shared";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { ListPostsDto } from "./dto/list-posts.dto";
import { SchedulePostDto } from "./dto/schedule-post.dto";

@Injectable()
export class PostsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService
  ) {}

  async list(userId: string, query: ListPostsDto) {
    await this.organizationsService.assertMembership(query.organizationId, userId);

    const params: unknown[] = [query.organizationId];
    const filters = ["p.organization_id = $1"];

    if (query.state) {
      params.push(query.state);
      filters.push(`p.state = $${params.length}`);
    }

    return this.databaseService.query(
      `
        select
          p.id,
          p.organization_id as "organizationId",
          p.title,
          p.content,
          p.scheduled_at as "scheduledAt",
          p.state,
          p.primary_media_asset_id as "primaryMediaAssetId",
          count(pt.id)::int as "targetCount"
        from posts p
        left join post_targets pt on pt.post_id = p.id
        where ${filters.join(" and ")}
        group by p.id
        order by coalesce(p.scheduled_at, p.created_at) desc
      `,
      params
    );
  }

  async create(userId: string, dto: CreatePostDto) {
    await this.organizationsService.assertMembership(dto.organizationId, userId);
    await this.assertTargetAccounts(dto.organizationId, dto.targetSocialAccountIds);

    const state: PostState = dto.scheduledAt ? "scheduled" : "draft";

    return this.databaseService.transaction(async (client) => {
      const [post] = await this.databaseService.query<{
        id: string;
        organizationId: string;
        title: string;
        content: string;
        scheduledAt: string | null;
        state: PostState;
      }>(
        `
          insert into posts (
            organization_id,
            author_user_id,
            title,
            content,
            primary_media_asset_id,
            scheduled_at,
            state
          )
          values ($1, $2, $3, $4, $5, $6, $7)
          returning
            id,
            organization_id as "organizationId",
            title,
            content,
            scheduled_at as "scheduledAt",
            state
        `,
        [dto.organizationId, userId, dto.title, dto.content, dto.primaryMediaAssetId ?? null, dto.scheduledAt ?? null, state],
        client
      );

      for (const targetId of dto.targetSocialAccountIds) {
        await this.databaseService.query(
          `
            insert into post_targets (post_id, social_account_id, provider, status)
            select $1, sa.id, sa.provider, 'pending'
            from social_accounts sa
            where sa.id = $2
          `,
          [post.id, targetId],
          client
        );
      }

      await this.auditService.record(
        {
          organizationId: dto.organizationId,
          actorUserId: userId,
          entityType: "post",
          entityId: post.id,
          action: "post.created",
          payload: {
            title: dto.title,
            scheduledAt: dto.scheduledAt ?? null
          }
        },
        client
      );

      return post;
    });
  }

  async schedule(userId: string, postId: string, dto: SchedulePostDto) {
    await this.organizationsService.assertMembership(dto.organizationId, userId);
    await this.assertPostOwnership(postId, dto.organizationId);
    await this.assertPostReadyToSchedule(postId);

    const [post] = await this.databaseService.query(
      `
        update posts
        set scheduled_at = $1,
            state = 'scheduled',
            updated_at = now()
        where id = $2 and organization_id = $3
        returning id, scheduled_at as "scheduledAt", state
      `,
      [dto.scheduledAt, postId, dto.organizationId]
    );

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorUserId: userId,
      entityType: "post",
      entityId: postId,
      action: "post.scheduled",
      payload: { scheduledAt: dto.scheduledAt }
    });

    return post;
  }

  async publishNow(userId: string, postId: string, organizationId: string) {
    const now = new Date().toISOString();
    return this.schedule(userId, postId, { organizationId, scheduledAt: now });
  }

  async cancel(userId: string, postId: string, organizationId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);
    await this.assertPostOwnership(postId, organizationId);

    await this.databaseService.transaction(async (client) => {
      await this.databaseService.query(
        `
          update posts
          set state = 'cancelled',
              updated_at = now()
          where id = $1 and organization_id = $2
        `,
        [postId, organizationId],
        client
      );

      await this.databaseService.query(
        `
          update post_targets
          set status = 'cancelled'
          where post_id = $1 and status = 'pending'
        `,
        [postId],
        client
      );

      await this.auditService.record(
        {
          organizationId,
          actorUserId: userId,
          entityType: "post",
          entityId: postId,
          action: "post.cancelled",
          payload: {}
        },
        client
      );
    });

    return { id: postId, state: "cancelled" };
  }

  async claimDuePosts(limit = 10) {
    return this.databaseService.transaction(async (client) => {
      const posts = await this.databaseService.query<{ id: string }>(
        `
          select id
          from posts
          where state = 'scheduled'
            and scheduled_at is not null
            and scheduled_at <= now()
          order by scheduled_at asc
          limit $1
          for update skip locked
        `,
        [limit],
        client
      );

      for (const post of posts) {
        await this.databaseService.query(
          `
            update posts
            set state = 'publishing',
                updated_at = now()
            where id = $1
          `,
          [post.id],
          client
        );
      }

      return posts.map((post) => post.id);
    });
  }

  async getPublishingPayload(postId: string) {
    const [post] = await this.databaseService.query<{
      id: string;
      organizationId: string;
      title: string;
      content: string;
      primaryMediaAssetId: string | null;
      storageBucket: string | null;
      storagePath: string | null;
    }>(
      `
        select p.id,
               p.organization_id as "organizationId",
               p.title,
               p.content,
               p.primary_media_asset_id as "primaryMediaAssetId",
               ma.storage_bucket as "storageBucket",
               ma.storage_path as "storagePath"
        from posts p
        left join media_assets ma on ma.id = p.primary_media_asset_id
        where p.id = $1
      `,
      [postId]
    );

    if (!post) {
      throw new NotFoundException("Post not found");
    }

    const targets = await this.databaseService.query<{
      id: string;
      provider: "facebook" | "instagram" | "linkedin";
      socialAccountId: string;
      displayName: string;
      handle: string;
      accessTokenEncrypted: string | null;
      status: "pending" | "published" | "failed" | "cancelled";
      metadata: Record<string, unknown> | null;
    }>(
      `
        select pt.id,
               pt.provider,
               pt.social_account_id as "socialAccountId",
               sa.display_name as "displayName",
               sa.handle,
               sa.access_token_encrypted as "accessTokenEncrypted",
               pt.status,
               sa.metadata
        from post_targets pt
        inner join social_accounts sa on sa.id = pt.social_account_id
        where pt.post_id = $1
      `,
      [postId]
    );

    return { post, targets };
  }

  async recordPublishResult(
    postId: string,
    results: Array<{
      postTargetId: string;
      success: boolean;
      externalPostId?: string;
      errorMessage?: string;
      responsePayload?: Record<string, unknown>;
    }>
  ) {
    await this.databaseService.transaction(async (client) => {
      let hasFailures = false;

      for (const [index, result] of results.entries()) {
        if (!result.success) {
          hasFailures = true;
        }

        await this.databaseService.query(
          `
            insert into publish_jobs (
              post_target_id,
              attempt_number,
              status,
              external_post_id,
              error_message,
              response_payload,
              started_at,
              completed_at
            )
            values ($1, $2, $3, $4, $5, $6, now(), now())
          `,
          [
            result.postTargetId,
            index + 1,
            result.success ? "published" : "failed",
            result.externalPostId ?? null,
            result.errorMessage ?? null,
            result.responsePayload ?? {},
          ],
          client
        );

        await this.databaseService.query(
          `
            update post_targets
            set status = $2
            where id = $1
          `,
          [result.postTargetId, result.success ? "published" : "failed"],
          client
        );
      }

      await this.databaseService.query(
        `
          update posts
          set state = $2,
              last_error = $3,
              updated_at = now()
          where id = $1
        `,
        [
          postId,
          hasFailures ? "failed" : "published",
          hasFailures ? results.find((result) => !result.success)?.errorMessage ?? "Unknown error" : null
        ],
        client
      );
    });
  }

  private async assertPostReadyToSchedule(postId: string) {
    const [post] = await this.databaseService.query<{
      target_count: number;
      connected_target_count: number;
    }>(
      `
        select count(pt.id)::int as target_count,
               count(pt.id) filter (where sa.status = 'connected')::int as connected_target_count
        from post_targets pt
        inner join social_accounts sa on sa.id = pt.social_account_id
        where pt.post_id = $1
      `,
      [postId]
    );

    if (!post || post.target_count === 0) {
      throw new BadRequestException("A post must have at least one target account");
    }

    if (post.connected_target_count !== post.target_count) {
      throw new BadRequestException("All target accounts must be connected before scheduling");
    }
  }

  private async assertTargetAccounts(organizationId: string, targetIds: string[]) {
    if (!targetIds.length) {
      throw new BadRequestException("At least one target account is required");
    }

    const accounts = await this.databaseService.query<{ id: string }>(
      `
        select id
        from social_accounts
        where organization_id = $1
          and id = any($2::uuid[])
      `,
      [organizationId, targetIds]
    );

    if (accounts.length !== targetIds.length) {
      throw new BadRequestException("One or more target accounts are invalid for this organization");
    }
  }

  private async assertPostOwnership(postId: string, organizationId: string) {
    const [post] = await this.databaseService.query<{ id: string }>(
      `
        select id
        from posts
        where id = $1 and organization_id = $2
      `,
      [postId, organizationId]
    );

    if (!post) {
      throw new NotFoundException("Post not found for this organization");
    }
  }
}
