import { Injectable } from "@nestjs/common";
import { TokenCipherService } from "../../common/crypto/token-cipher.service";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreateSocialAccountDto } from "./dto/create-social-account.dto";

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
    private readonly tokenCipherService: TokenCipherService
  ) {}

  async listForOrganization(organizationId: string, userId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    return this.databaseService.query(
      `
        select id, organization_id as "organizationId", provider, display_name as "displayName",
               handle, status, token_expires_at as "tokenExpiresAt"
        from social_accounts
        where organization_id = $1
        order by created_at desc
      `,
      [organizationId]
    );
  }

  async create(userId: string, dto: CreateSocialAccountDto) {
    await this.organizationsService.assertMembership(dto.organizationId, userId);

    const [account] = await this.databaseService.query(
      `
        insert into social_accounts (
          organization_id,
          provider,
          display_name,
          handle,
          external_account_id,
          access_token_encrypted,
          refresh_token_encrypted,
          token_expires_at,
          status,
          metadata,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id, organization_id as "organizationId", provider,
                  display_name as "displayName", handle, status,
                  token_expires_at as "tokenExpiresAt"
      `,
      [
        dto.organizationId,
        dto.provider,
        dto.displayName,
        dto.handle,
        dto.externalAccountId,
        dto.accessToken ? this.tokenCipherService.encrypt(dto.accessToken) : null,
        dto.refreshToken ? this.tokenCipherService.encrypt(dto.refreshToken) : null,
        dto.tokenExpiresAt ?? null,
        dto.accessToken ? "connected" : "disconnected",
        dto.metadata ?? {},
        userId
      ]
    );

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorUserId: userId,
      entityType: "social_account",
      entityId: account.id,
      action: "social_account.created",
      payload: {
        provider: dto.provider,
        handle: dto.handle
      }
    });

    return account;
  }
}
