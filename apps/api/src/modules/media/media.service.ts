import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../database/database.service";
import { SupabaseAdminService } from "../../database/supabase-admin.service";
import { AppEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";

@Injectable()
export class MediaService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly supabaseAdminService: SupabaseAdminService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService
  ) {}

  async listForOrganization(organizationId: string, userId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    return this.databaseService.query<{
      id: string;
      organizationId: string;
      storagePath: string;
      mimeType: string;
      fileSizeBytes: number;
      width: number | null;
      height: number | null;
      usageCount: number;
    }>(
      `
        select
          ma.id,
          ma.organization_id as "organizationId",
          ma.storage_path as "storagePath",
          ma.mime_type as "mimeType",
          ma.file_size_bytes as "fileSizeBytes",
          ma.width,
          ma.height,
          count(p.id)::int as "usageCount"
        from media_assets ma
        left join posts p on p.primary_media_asset_id = ma.id
        where ma.organization_id = $1
        group by ma.id
        order by ma.created_at desc
      `,
      [organizationId]
    );
  }

  async createUploadUrl(userId: string, dto: CreateUploadUrlDto) {
    await this.organizationsService.assertMembership(dto.organizationId, userId);

    if (!dto.mimeType.startsWith("image/")) {
      throw new BadRequestException("Only image uploads are allowed in v1");
    }

    const storagePath = `${dto.organizationId}/${Date.now()}-${sanitizeFileName(dto.fileName)}`;
    const bucket = this.configService.get("supabaseStorageBucket", { infer: true });

    const { data, error } = await this.supabaseAdminService.client.storage.from(bucket).createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new BadRequestException(error?.message ?? "Unable to create signed upload URL");
    }

    const [asset] = await this.databaseService.query(
      `
        insert into media_assets (
          organization_id,
          storage_bucket,
          storage_path,
          mime_type,
          file_size_bytes,
          width,
          height,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, storage_path as "storagePath"
      `,
      [dto.organizationId, bucket, storagePath, dto.mimeType, dto.fileSizeBytes, dto.width ?? null, dto.height ?? null, userId]
    );

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorUserId: userId,
      entityType: "media_asset",
      entityId: asset.id,
      action: "media_asset.created",
      payload: {
        storagePath,
        mimeType: dto.mimeType
      }
    });

    return {
      assetId: asset.id,
      bucket,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl
    };
  }

  async createViewUrl(userId: string, organizationId: string, assetId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    const [asset] = await this.databaseService.query<{
      id: string;
      storageBucket: string;
      storagePath: string;
    }>(
      `
        select
          id,
          storage_bucket as "storageBucket",
          storage_path as "storagePath"
        from media_assets
        where id = $1
          and organization_id = $2
      `,
      [assetId, organizationId]
    );

    if (!asset) {
      throw new BadRequestException("Media introuvable pour cette organisation.");
    }

    const expiresInSeconds = 3600;
    const { data, error } = await this.supabaseAdminService.client.storage
      .from(asset.storageBucket)
      .createSignedUrl(asset.storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new BadRequestException(error?.message ?? "Impossible de generer l'URL de consultation du media.");
    }

    return {
      assetId,
      signedUrl: data.signedUrl,
      expiresInSeconds
    };
  }

  async deleteMedia(userId: string, organizationId: string, assetId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    const [asset] = await this.databaseService.query<{
      id: string;
      organizationId: string;
      storageBucket: string;
      storagePath: string;
      usageCount: number;
    }>(
      `
        select
          ma.id,
          ma.organization_id as "organizationId",
          ma.storage_bucket as "storageBucket",
          ma.storage_path as "storagePath",
          count(p.id)::int as "usageCount"
        from media_assets ma
        left join posts p on p.primary_media_asset_id = ma.id
        where ma.id = $1
          and ma.organization_id = $2
        group by ma.id
      `,
      [assetId, organizationId]
    );

    if (!asset) {
      throw new BadRequestException("Media introuvable pour cette organisation.");
    }

    const { error } = await this.supabaseAdminService.client.storage
      .from(asset.storageBucket)
      .remove([asset.storagePath]);

    if (error) {
      throw new BadRequestException(error.message ?? "Impossible de supprimer le fichier du stockage.");
    }

    await this.databaseService.query(
      `
        delete from media_assets
        where id = $1
          and organization_id = $2
      `,
      [assetId, organizationId]
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      entityType: "media_asset",
      entityId: asset.id,
      action: "media_asset.deleted",
      payload: {
        storagePath: asset.storagePath,
        usageCount: asset.usageCount
      }
    });

    return {
      id: asset.id,
      deleted: true as const,
      usageCount: asset.usageCount
    };
  }
}

const sanitizeFileName = (fileName: string) => fileName.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
