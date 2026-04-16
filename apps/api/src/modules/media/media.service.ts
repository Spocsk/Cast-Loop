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
    }>(
      `
        select
          id,
          organization_id as "organizationId",
          storage_path as "storagePath",
          mime_type as "mimeType",
          file_size_bytes as "fileSizeBytes",
          width,
          height
        from media_assets
        where organization_id = $1
        order by created_at desc
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
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl
    };
  }
}

const sanitizeFileName = (fileName: string) => fileName.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
