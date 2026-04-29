import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isISO8601, isUUID } from "class-validator";
import { PoolClient } from "pg";
import {
  CreatePostResult,
  ImportPostError,
  ImportPostsResult,
  PostState,
  PostTargetStatus
} from "@cast-loop/shared";
import { AppEnv } from "../../config/env";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { ImportPostItemDto, ImportPostsDto } from "./dto/import-posts.dto";
import { ListPostsDto } from "./dto/list-posts.dto";
import { SchedulePostDto } from "./dto/schedule-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";

const MAX_IMPORT_POSTS = 100;

type NormalizedImportPost = Omit<CreatePostDto, "organizationId"> & {
  targetSocialAccountIds?: string[];
};

type PostWriteDto = CreatePostDto | (NormalizedImportPost & { organizationId: string });

@Injectable()
export class PostsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<AppEnv, true>
  ) {}

  async list(userId: string, query: ListPostsDto) {
    await this.organizationsService.assertPermission(query.organizationId, userId, "posts.read");

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
          p.send_telegram_reminder as "sendTelegramReminder",
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
    await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.write");
    if (dto.scheduledAt) {
      await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.schedule");
    }

    const targetIds = [...new Set(dto.targetSocialAccountIds ?? [])];

    if (dto.scheduledAt) {
      await this.assertScheduledTargets(dto.organizationId, targetIds, dto.sendTelegramReminder ?? false);
    } else if (targetIds.length > 0) {
      await this.assertTargetAccounts(dto.organizationId, targetIds);
    }

    const state: PostState = dto.scheduledAt ? "scheduled" : "draft";

    return this.databaseService.transaction(async (client) => {
      return this.insertPost(userId, dto, targetIds, state, client, "post.created");
    });
  }

  async importPosts(userId: string, dto: ImportPostsDto): Promise<ImportPostsResult> {
    await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.write");
    if (dto.posts.some((post) => post.scheduledAt)) {
      await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.schedule");
    }

    const normalized = await this.validateImportPosts(dto);

    const posts = await this.databaseService.transaction(async (client) => {
      const createdPosts: CreatePostResult[] = [];

      for (const post of normalized) {
        const targetIds = [...new Set(post.targetSocialAccountIds ?? [])];
        const state: PostState = post.scheduledAt ? "scheduled" : "draft";
        const createdPost = await this.insertPost(
          userId,
          { ...post, organizationId: dto.organizationId },
          targetIds,
          state,
          client,
          "post.imported"
        );

        createdPosts.push(createdPost);
      }

      await this.auditService.record(
        {
          organizationId: dto.organizationId,
          actorUserId: userId,
          entityType: "post_import",
          entityId: dto.organizationId,
          action: "post.import.completed",
          payload: { createdCount: createdPosts.length }
        },
        client
      );

      return createdPosts;
    });

    return { createdCount: posts.length, posts };
  }

  async update(userId: string, postId: string, dto: UpdatePostDto) {
    await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.write");
    if (dto.scheduledAt) {
      await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.schedule");
    }
    await this.assertPostEditable(postId, dto.organizationId);

    const targetIds = [...new Set(dto.targetSocialAccountIds ?? [])];

    if (dto.scheduledAt) {
      await this.assertScheduledTargets(dto.organizationId, targetIds, dto.sendTelegramReminder ?? false);
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
        sendTelegramReminder: boolean;
      }>(
        `
          update posts
          set title = $1,
              content = $2,
              primary_media_asset_id = $3,
              scheduled_at = $4,
              state = $5,
              send_telegram_reminder = $6,
              updated_at = now()
          where id = $7 and organization_id = $8
          returning
            id,
            organization_id as "organizationId",
            title,
            content,
            scheduled_at as "scheduledAt",
            state,
            send_telegram_reminder as "sendTelegramReminder"
        `,
        [
          dto.title,
          dto.content,
          dto.primaryMediaAssetId ?? null,
          dto.scheduledAt ?? null,
          state,
          dto.sendTelegramReminder ?? false,
          postId,
          dto.organizationId
        ],
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
            targetCount: targetIds.length,
            sendTelegramReminder: dto.sendTelegramReminder ?? false
          }
        },
        client
      );

      return post;
    });
  }

  async schedule(userId: string, postId: string, dto: SchedulePostDto) {
    await this.organizationsService.assertPermission(dto.organizationId, userId, "posts.schedule");
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
    await this.organizationsService.assertPermission(organizationId, userId, "posts.publish");
    const now = new Date().toISOString();
    return this.schedule(userId, postId, { organizationId, scheduledAt: now });
  }

  async cancel(userId: string, postId: string, organizationId: string) {
    await this.organizationsService.assertPermission(organizationId, userId, "posts.schedule");
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
    await this.organizationsService.assertPermission(organizationId, userId, "posts.archive");
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
    await this.organizationsService.assertPermission(organizationId, userId, "posts.archive");
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
    await this.organizationsService.assertPermission(organizationId, userId, "posts.delete");
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
      scheduledAt: string | null;
      sendTelegramReminder: boolean;
      primaryMediaAssetId: string | null;
      storageBucket: string | null;
      storagePath: string | null;
      mimeType: string | null;
    }>(
      `
        select p.id,
               p.organization_id as "organizationId",
               p.title,
               p.content,
               p.scheduled_at as "scheduledAt",
               p.send_telegram_reminder as "sendTelegramReminder",
               p.primary_media_asset_id as "primaryMediaAssetId",
               ma.storage_bucket as "storageBucket",
               ma.storage_path as "storagePath",
               ma.mime_type as "mimeType"
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
      publishCapability: "publishable" | "connect_only";
      accountType: "personal" | "page" | "business" | "creator";
      status: "pending" | "published" | "notified" | "failed" | "cancelled";
      metadata: Record<string, unknown> | null;
    }>(
      `
        select pt.id,
               pt.provider,
               pt.social_account_id as "socialAccountId",
               sa.display_name as "displayName",
               sa.handle,
               sa.access_token_encrypted as "accessTokenEncrypted",
               sa.publish_capability as "publishCapability",
               sa.account_type as "accountType",
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
      targetStatus: PostTargetStatus;
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
            result.targetStatus,
            result.externalPostId ?? null,
            result.errorMessage ?? null,
            result.responsePayload ?? {}
          ],
          client
        );

        await this.databaseService.query(
          `
            update post_targets
            set status = $2
            where id = $1
          `,
          [result.postTargetId, result.targetStatus],
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
          hasFailures ? (results.find((result) => !result.success)?.errorMessage ?? "Unknown error") : null
        ],
        client
      );
    });
  }

  private async insertPost(
    userId: string,
    dto: PostWriteDto,
    targetIds: string[],
    state: PostState,
    client: PoolClient,
    auditAction: "post.created" | "post.imported"
  ): Promise<CreatePostResult> {
    const [post] = await this.databaseService.query<{
      id: string;
      organizationId: string;
      title: string;
      content: string;
      scheduledAt: string | null;
      state: PostState;
      sendTelegramReminder: boolean;
    }>(
      `
        insert into posts (
          organization_id,
          author_user_id,
          title,
          content,
          primary_media_asset_id,
          scheduled_at,
          state,
          send_telegram_reminder
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          organization_id as "organizationId",
          title,
          content,
          scheduled_at as "scheduledAt",
          state,
          send_telegram_reminder as "sendTelegramReminder"
      `,
      [
        dto.organizationId,
        userId,
        dto.title,
        dto.content,
        dto.primaryMediaAssetId ?? null,
        dto.scheduledAt ?? null,
        state,
        dto.sendTelegramReminder ?? false
      ],
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
        action: auditAction,
        payload: {
          title: dto.title,
          scheduledAt: dto.scheduledAt ?? null,
          sendTelegramReminder: dto.sendTelegramReminder ?? false
        }
      },
      client
    );

    return post;
  }

  private async validateImportPosts(dto: ImportPostsDto): Promise<NormalizedImportPost[]> {
    const errors: ImportPostError[] = [];

    if (dto.posts.length === 0) {
      errors.push({
        row: 0,
        field: "posts",
        message: "Le fichier ne contient aucun post."
      });
    }

    if (dto.posts.length > MAX_IMPORT_POSTS) {
      errors.push({
        row: 0,
        field: "posts",
        message: `Le fichier ne peut pas contenir plus de ${MAX_IMPORT_POSTS} posts.`
      });
    }

    const normalized = dto.posts.map((post, index) => this.normalizeImportPost(post, index + 1, errors));
    const validPosts = normalized.filter((post): post is NormalizedImportPost => post !== null);
    const targetIds = [...new Set(validPosts.flatMap((post) => post.targetSocialAccountIds ?? []))];
    const mediaIds = [
      ...new Set(validPosts.flatMap((post) => (post.primaryMediaAssetId ? [post.primaryMediaAssetId] : [])))
    ];
    const accountsById = await this.getImportTargetAccounts(dto.organizationId, targetIds);
    const mediaIdsForOrganization = await this.getImportMediaAssetIds(dto.organizationId, mediaIds);

    for (const [index, post] of validPosts.entries()) {
      const row = this.findImportRow(normalized, post, index);
      const postTargetIds = post.targetSocialAccountIds ?? [];

      if (post.primaryMediaAssetId && !mediaIdsForOrganization.has(post.primaryMediaAssetId)) {
        errors.push({
          row,
          field: "primaryMediaAssetId",
          message: "Ce media n'existe pas dans l'organisation active."
        });
      }

      const accounts = postTargetIds.map((targetId) => accountsById.get(targetId));

      if (postTargetIds.some((targetId) => !accountsById.has(targetId))) {
        errors.push({
          row,
          field: "targetSocialAccountIds",
          message: "Un ou plusieurs comptes cibles sont invalides pour cette organisation."
        });
        continue;
      }

      if (post.scheduledAt && postTargetIds.length === 0) {
        errors.push({
          row,
          field: "targetSocialAccountIds",
          message: "Au moins un compte cible est requis pour planifier un post."
        });
        continue;
      }

      if (post.scheduledAt && accounts.some((account) => account?.status !== "connected")) {
        errors.push({
          row,
          field: "targetSocialAccountIds",
          message: "Tous les comptes cibles doivent etre connectes avant de planifier."
        });
      }

      const hasConnectOnly = accounts.some((account) => account?.publishCapability === "connect_only");

      if (post.sendTelegramReminder && !hasConnectOnly) {
        errors.push({
          row,
          field: "sendTelegramReminder",
          message:
            "Le rappel Telegram ne peut etre active que si au moins un compte en connexion seule est selectionne."
        });
      }

      if (post.scheduledAt && hasConnectOnly && !post.sendTelegramReminder) {
        errors.push({
          row,
          field: "sendTelegramReminder",
          message: "Activez le rappel Telegram pour planifier un post avec des comptes en connexion seule."
        });
      }

      if (post.scheduledAt && hasConnectOnly && post.sendTelegramReminder) {
        try {
          this.assertTelegramConfigured();
        } catch (error) {
          errors.push({
            row,
            field: "sendTelegramReminder",
            message: error instanceof Error ? error.message : "La configuration Telegram est incomplete."
          });
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: "Le fichier contient des erreurs. Aucun post n'a ete cree.",
        errors
      });
    }

    return validPosts;
  }

  private normalizeImportPost(
    post: ImportPostItemDto,
    row: number,
    errors: ImportPostError[]
  ): NormalizedImportPost | null {
    const title = this.normalizeRequiredString(post.title, row, "title", 120, errors);
    const content = this.normalizeRequiredString(post.content, row, "content", 5000, errors);
    const scheduledAt = this.normalizeOptionalIsoDate(post.scheduledAt, row, errors);
    const targetSocialAccountIds = this.normalizeOptionalUuidArray(
      post.targetSocialAccountIds,
      row,
      "targetSocialAccountIds",
      errors
    );
    const primaryMediaAssetId = this.normalizeOptionalUuid(
      post.primaryMediaAssetId,
      row,
      "primaryMediaAssetId",
      errors
    );
    const sendTelegramReminder = this.normalizeOptionalBoolean(post.sendTelegramReminder, row, errors);

    if (
      !title ||
      !content ||
      scheduledAt === null ||
      targetSocialAccountIds === null ||
      primaryMediaAssetId === null ||
      sendTelegramReminder === null
    ) {
      return null;
    }

    return {
      title,
      content,
      primaryMediaAssetId: primaryMediaAssetId ?? undefined,
      targetSocialAccountIds:
        targetSocialAccountIds.length > 0 ? [...new Set(targetSocialAccountIds)] : undefined,
      scheduledAt,
      sendTelegramReminder
    };
  }

  private normalizeRequiredString(
    value: unknown,
    row: number,
    field: "title" | "content",
    maxLength: number,
    errors: ImportPostError[]
  ) {
    if (typeof value !== "string") {
      errors.push({ row, field, message: "Ce champ est requis." });
      return null;
    }

    const normalized = value.trim();

    if (normalized.length === 0) {
      errors.push({ row, field, message: "Ce champ est requis." });
      return null;
    }

    if (normalized.length > maxLength) {
      errors.push({ row, field, message: `Ce champ ne peut pas depasser ${maxLength} caracteres.` });
      return null;
    }

    return normalized;
  }

  private normalizeOptionalIsoDate(value: unknown, row: number, errors: ImportPostError[]) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value !== "string" || !isISO8601(value, { strict: true, strictSeparator: true })) {
      errors.push({ row, field: "scheduledAt", message: "La date doit etre au format ISO 8601." });
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      errors.push({ row, field: "scheduledAt", message: "La date doit etre valide." });
      return null;
    }

    return date.toISOString();
  }

  private normalizeOptionalUuid(
    value: unknown,
    row: number,
    field: "primaryMediaAssetId",
    errors: ImportPostError[]
  ) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value !== "string" || !isUUID(value, "4")) {
      errors.push({ row, field, message: "La valeur doit etre un UUID valide." });
      return null;
    }

    return value;
  }

  private normalizeOptionalUuidArray(
    value: unknown,
    row: number,
    field: "targetSocialAccountIds",
    errors: ImportPostError[]
  ) {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      errors.push({ row, field, message: "La valeur doit etre une liste d'UUID." });
      return null;
    }

    const values = value.filter((item) => item !== "");

    if (values.some((item) => typeof item !== "string" || !isUUID(item, "4"))) {
      errors.push({ row, field, message: "Chaque compte cible doit etre un UUID valide." });
      return null;
    }

    return values as string[];
  }

  private normalizeOptionalBoolean(value: unknown, row: number, errors: ImportPostError[]) {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value !== "boolean") {
      errors.push({ row, field: "sendTelegramReminder", message: "La valeur doit etre true ou false." });
      return null;
    }

    return value;
  }

  private async getImportTargetAccounts(organizationId: string, targetIds: string[]) {
    if (targetIds.length === 0) {
      return new Map<
        string,
        { id: string; status: string; publishCapability: "publishable" | "connect_only" }
      >();
    }

    const accounts = await this.databaseService.query<{
      id: string;
      status: string;
      publishCapability: "publishable" | "connect_only";
    }>(
      `
        select
          id,
          status,
          publish_capability as "publishCapability"
        from social_accounts
        where organization_id = $1
          and id = any($2::uuid[])
      `,
      [organizationId, targetIds]
    );

    return new Map(accounts.map((account) => [account.id, account]));
  }

  private async getImportMediaAssetIds(organizationId: string, mediaIds: string[]) {
    if (mediaIds.length === 0) {
      return new Set<string>();
    }

    const assets = await this.databaseService.query<{ id: string }>(
      `
        select id
        from media_assets
        where organization_id = $1
          and id = any($2::uuid[])
      `,
      [organizationId, mediaIds]
    );

    return new Set(assets.map((asset) => asset.id));
  }

  private findImportRow(
    normalized: Array<NormalizedImportPost | null>,
    post: NormalizedImportPost,
    fallbackIndex: number
  ) {
    const row = normalized.findIndex((candidate) => candidate === post);
    return row >= 0 ? row + 1 : fallbackIndex + 1;
  }

  private async assertPostReadyToSchedule(postId: string) {
    const [post] = await this.databaseService.query<{
      target_count: number;
      connected_target_count: number;
      connect_only_target_count: number;
      send_telegram_reminder: boolean;
    }>(
      `
        select count(pt.id)::int as target_count,
               count(pt.id) filter (where sa.status = 'connected')::int as connected_target_count,
               count(pt.id) filter (where sa.publish_capability = 'connect_only')::int as connect_only_target_count,
               p.send_telegram_reminder
        from post_targets pt
        inner join social_accounts sa on sa.id = pt.social_account_id
        inner join posts p on p.id = pt.post_id
        where pt.post_id = $1
        group by p.send_telegram_reminder
      `,
      [postId]
    );

    if (!post || post.target_count === 0) {
      throw new BadRequestException("A post must have at least one target account");
    }

    if (post.connected_target_count !== post.target_count) {
      throw new BadRequestException("All target accounts must be connected before scheduling");
    }

    if (post.connect_only_target_count > 0) {
      if (!post.send_telegram_reminder) {
        throw new BadRequestException(
          "Activez le rappel Telegram pour planifier un post avec des comptes en connexion seule."
        );
      }

      this.assertTelegramConfigured();
    } else if (post.send_telegram_reminder) {
      throw new BadRequestException(
        "Le rappel Telegram ne peut etre active que si au moins un compte en connexion seule est selectionne."
      );
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

  private async assertScheduledTargets(
    organizationId: string,
    targetIds: string[],
    sendTelegramReminder: boolean
  ) {
    if (targetIds.length === 0) {
      throw new BadRequestException("Au moins un compte cible est requis pour planifier un post");
    }

    const accounts = await this.databaseService.query<{
      id: string;
      status: string;
      publishCapability: "publishable" | "connect_only";
    }>(
      `
        select
          id,
          status,
          publish_capability as "publishCapability"
        from social_accounts
        where organization_id = $1
          and id = any($2::uuid[])
      `,
      [organizationId, targetIds]
    );

    if (accounts.length !== targetIds.length) {
      throw new BadRequestException("One or more target accounts are invalid for this organization");
    }

    if (accounts.some((account) => account.status !== "connected")) {
      throw new BadRequestException("Tous les comptes cibles doivent etre connectes avant de planifier");
    }

    const hasConnectOnly = accounts.some((account) => account.publishCapability === "connect_only");

    if (hasConnectOnly && !sendTelegramReminder) {
      throw new BadRequestException(
        "Activez le rappel Telegram pour planifier un post avec des comptes en connexion seule."
      );
    }

    if (!hasConnectOnly && sendTelegramReminder) {
      throw new BadRequestException(
        "Le rappel Telegram ne peut etre active que si au moins un compte en connexion seule est selectionne."
      );
    }

    if (hasConnectOnly) {
      this.assertTelegramConfigured();
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
      sendTelegramReminder: boolean;
    }>(
      `
        select
          id,
          state,
          archived_at as "archivedAt",
          send_telegram_reminder as "sendTelegramReminder"
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

  private assertTelegramConfigured() {
    if (
      !this.configService.get("telegramBotToken", { infer: true }) ||
      !this.configService.get("telegramChatId", { infer: true })
    ) {
      throw new BadRequestException(
        "Le rappel Telegram est requis pour ces comptes mais n'est pas configure sur le serveur."
      );
    }
  }
}
