import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PostState } from "@cast-loop/shared";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { ListPostsDto } from "./dto/list-posts.dto";
import { SchedulePostDto } from "./dto/schedule-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";

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
    const visibility = query.visibility ?? "active";

    filters.push(visibility === "archived" ? "p.archived_at is not null" : "p.archived_at is null");

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
          p.archived_at as "archivedAt",
          p.state,
          p.primary_media_asset_id as "primaryMediaAssetId",
          count(pt.id)::int as "targetCount",
          coalesce(array_remove(array_agg(pt.social_account_id), null), '{}'::uuid[]) as "targetSocialAccountIds"
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

    const targetIds = [...new Set(dto.targetSocialAccountIds ?? [])];

    if (dto.scheduledAt) {
      if (targetIds.length === 0) {
        throw new BadRequestException("Au moins un compte cible est requis pour planifier un post");
      }
      await this.assertTargetAccounts(dto.organizationId, targetIds);
      await this.assertTargetAccountsConnected(dto.organizationId, targetIds);
    } else if (targetIds.length > 0) {
      await this.assertTargetAccounts(dto.organizationId, targetIds);
    }

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

      for (const targetId of targetIds) {
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

  async update(userId: string, postId: string, dto: UpdatePostDto) {
    await this.organizationsService.assertMembership(dto.organizationId, userId);
    await this.assertPostEditable(postId, dto.organizationId);

    const targetIds = [...new Set(dto.targetSocialAccountIds ?? [])];

    if (dto.scheduledAt) {
      if (targetIds.length === 0) {
        throw new BadRequestException("Au moins un compte cible est requis pour planifier un post");
      }
      await this.assertTargetAccounts(dto.organizationId, targetIds);
      await this.assertTargetAccountsConnected(dto.organizationId, targetIds);
    } else if (targetIds.length > 0) {
      await this.assertTargetAccounts(dto.organizationId, targetIds);
    }

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
          update posts
          set title = $1,
              content = $2,
              primary_media_asset_id = $3,
              scheduled_at = $4,
              state = $5,
              updated_at = now()
          where id = $6 and organization_id = $7
          returning
            id,
            organization_id as "organizationId",
            title,
            content,
            scheduled_at as "scheduledAt",
            state
        `,
        [dto.title, dto.content, dto.primaryMediaAssetId ?? null, dto.scheduledAt ?? null, state, postId, dto.organizationId],
        client
      );

      await this.databaseService.query("delete from post_targets where post_id = $1", [postId], client);

      for (const targetId of targetIds) {
        await this.databaseService.query(
          `
            insert into post_targets (post_id, social_account_id, provider, status)
            select $1, sa.id, sa.provider, 'pending'
            from social_accounts sa
            where sa.id = $2
          `,
          [postId, targetId],
          client
        );
      }

      await this.auditService.record(
        {
          organizationId: dto.organizationId,
          actorUserId: userId,
          entityType: "post",
          entityId: postId,
          action: "post.updated",
          payload: {
            title: dto.title,
            scheduledAt: dto.scheduledAt ?? null,
            targetCount: targetIds.length
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

  async archive(userId: string, postId: string, organizationId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);
    const post = await this.assertPostEditable(postId, organizationId);

    const [archivedPost] = await this.databaseService.query<{ id: string; archivedAt: string }>(
      `
        update posts
        set archived_at = now(),
            updated_at = now()
        where id = $1 and organization_id = $2
        returning id, archived_at as "archivedAt"
      `,
      [postId, organizationId]
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      entityType: "post",
      entityId: postId,
      action: "post.archived",
      payload: { previousState: post.state }
    });

    return archivedPost;
  }

  async restore(userId: string, postId: string, organizationId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);
    const post = await this.getPostRecord(postId, organizationId);

    if (!post.archivedAt) {
      throw new BadRequestException("Ce post n'est pas archive.");
    }

    if (!this.isMutablePostState(post.state)) {
      throw new BadRequestException("Seuls les posts draft et scheduled peuvent etre restaures.");
    }

    const [restoredPost] = await this.databaseService.query<{ id: string; archivedAt: string | null }>(
      `
        update posts
        set archived_at = null,
            updated_at = now()
        where id = $1 and organization_id = $2
        returning id, archived_at as "archivedAt"
      `,
      [postId, organizationId]
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      entityType: "post",
      entityId: postId,
      action: "post.restored",
      payload: { restoredState: post.state }
    });

    return restoredPost;
  }

  async deleteArchived(userId: string, postId: string, organizationId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);
    const post = await this.getPostRecord(postId, organizationId);

    if (!post.archivedAt) {
      throw new BadRequestException("Archivez d'abord le post avant de le supprimer definitivement.");
    }

    await this.databaseService.transaction(async (client) => {
      await this.databaseService.query(
        `
          delete from posts
          where id = $1
            and organization_id = $2
            and archived_at is not null
        `,
        [postId, organizationId],
        client
      );

      await this.auditService.record(
        {
          organizationId,
          actorUserId: userId,
          entityType: "post",
          entityId: postId,
          action: "post.deleted",
          payload: { previousState: post.state }
        },
        client
      );
    });

    return { id: postId, deleted: true };
  }

  async claimDuePosts(limit = 10) {
    return this.databaseService.transaction(async (client) => {
      const posts = await this.databaseService.query<{ id: string }>(
        `
          select id
          from posts
          where state = 'scheduled'
            and archived_at is null
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

  private async assertTargetAccountsConnected(organizationId: string, targetIds: string[]) {
    const accounts = await this.databaseService.query<{ id: string; status: string }>(
      `
        select id, status
        from social_accounts
        where organization_id = $1
          and id = any($2::uuid[])
      `,
      [organizationId, targetIds]
    );

    if (accounts.some((account) => account.status !== "connected")) {
      throw new BadRequestException("Tous les comptes cibles doivent etre connectes avant de planifier");
    }
  }

  private async assertTargetAccounts(organizationId: string, targetIds: string[]) {
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

  private async assertPostEditable(postId: string, organizationId: string) {
    const post = await this.getPostRecord(postId, organizationId);

    if (post.archivedAt) {
      throw new BadRequestException("Un post archive doit etre restaure avant modification.");
    }

    if (!this.isMutablePostState(post.state)) {
      throw new BadRequestException("Seuls les posts draft et scheduled peuvent etre modifies.");
    }

    return post;
  }

  private isMutablePostState(state: PostState) {
    return state === "draft" || state === "scheduled";
  }

  private async getPostRecord(postId: string, organizationId: string) {
    const [post] = await this.databaseService.query<{
      id: string;
      state: PostState;
      archivedAt: string | null;
    }>(
      `
        select id, state, archived_at as "archivedAt"
        from posts
        where id = $1 and organization_id = $2
      `,
      [postId, organizationId]
    );

    if (!post) {
      throw new NotFoundException("Post not found for this organization");
    }

    return post;
  }

  private async assertPostOwnership(postId: string, organizationId: string) {
    await this.getPostRecord(postId, organizationId);
  }
}
