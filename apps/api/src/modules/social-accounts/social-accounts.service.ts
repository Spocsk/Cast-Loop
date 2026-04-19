import {
  SocialAccountCapability,
  SocialAccountSummary,
  SocialConnectionCallbackStatus,
  SocialProvider,
  SocialProviderAvailability,
  SocialProviderConnectionVariant,
  StartSocialConnectionInput,
  StartSocialConnectionResult
} from "@cast-loop/shared";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppEnv } from "../../config/env";
import { TokenCipherService } from "../../common/crypto/token-cipher.service";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreateSocialAccountDto } from "./dto/create-social-account.dto";
import { LinkedInOAuthService, LinkedInOAuthServiceError, NormalizedSocialAccount } from "./linkedin-oauth.service";
import { MetaOAuthService } from "./meta-oauth.service";

interface OAuthStatePayload {
  provider: SocialProvider;
  variant: SocialProviderConnectionVariant;
  organizationId: string;
  userId: string;
  expiresAt: number;
}

interface PendingSelectionPayload {
  provider: SocialProvider;
  variant: SocialProviderConnectionVariant;
  organizationId: string;
  userId: string;
  expiresAt: number;
  accounts: NormalizedSocialAccount[];
}

interface SocialConnectionRedirectResult {
  status: SocialConnectionCallbackStatus;
  redirectUrl: string;
}

interface SocialProviderVariantDefinition {
  provider: SocialProvider;
  variant: SocialProviderConnectionVariant;
  label: string;
  capability: SocialAccountCapability;
}

const PROVIDER_VARIANTS: SocialProviderVariantDefinition[] = [
  {
    provider: "linkedin",
    variant: "linkedin_personal",
    label: "Profil LinkedIn",
    capability: "publishable"
  },
  {
    provider: "linkedin",
    variant: "linkedin_page",
    label: "Page LinkedIn",
    capability: "publishable"
  },
  {
    provider: "facebook",
    variant: "facebook_page",
    label: "Page Facebook",
    capability: "publishable"
  },
  {
    provider: "instagram",
    variant: "instagram_professional",
    label: "Compte Instagram pro",
    capability: "publishable"
  },
  {
    provider: "facebook",
    variant: "meta_personal",
    label: "Profil Facebook",
    capability: "connect_only"
  }
];

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
    private readonly tokenCipherService: TokenCipherService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly linkedInOAuthService: LinkedInOAuthService,
    private readonly metaOAuthService: MetaOAuthService
  ) {}

  async listForOrganization(organizationId: string, userId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    return this.databaseService.query<SocialAccountSummary>(
      `
        select
          id,
          organization_id as "organizationId",
          provider,
          display_name as "displayName",
          handle,
          account_type as "accountType",
          publish_capability as "publishCapability",
          status,
          token_expires_at as "tokenExpiresAt"
        from social_accounts
        where organization_id = $1
        order by created_at desc
      `,
      [organizationId]
    );
  }

  async listProviderAvailability(organizationId: string, userId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    return PROVIDER_VARIANTS.map((entry) => ({
      provider: entry.provider,
      variant: entry.variant,
      label: entry.label,
      enabled: this.isVariantConfigured(entry.variant),
      capability: entry.capability,
      reason: this.isVariantConfigured(entry.variant)
        ? entry.capability === "connect_only"
          ? "Connexion informative uniquement."
          : null
        : `${entry.label} non configure sur le serveur.`
    })) satisfies SocialProviderAvailability[];
  }

  async create(userId: string, dto: CreateSocialAccountDto) {
    await this.organizationsService.assertMembership(dto.organizationId, userId);
    return this.upsertAccount(userId, dto);
  }

  async startConnection(userId: string, organizationId: string, provider: SocialProvider, input: StartSocialConnectionInput) {
    await this.organizationsService.assertMembership(organizationId, userId);
    this.assertProviderVariant(provider, input.variant);

    if (!this.isVariantConfigured(input.variant)) {
      throw new BadRequestException("Ce provider n'est pas configure sur le serveur.");
    }

    const state = this.encodeOAuthState({
      provider,
      variant: input.variant,
      organizationId,
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    return {
      provider,
      variant: input.variant,
      authorizationUrl: this.getAuthorizationUrl(input.variant, state)
    } satisfies StartSocialConnectionResult;
  }

  async handleLinkedInCallback(params: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<SocialConnectionRedirectResult> {
    return this.handleOAuthCallback("linkedin", params);
  }

  async handleMetaCallback(params: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<SocialConnectionRedirectResult> {
    return this.handleOAuthCallback("meta", params);
  }

  async getPendingSelection(userId: string, organizationId: string, selectionToken: string) {
    await this.organizationsService.assertMembership(organizationId, userId);
    const payload = this.decodePendingSelection(selectionToken);

    if (!payload || payload.organizationId !== organizationId || payload.userId !== userId || payload.expiresAt < Date.now()) {
      throw new BadRequestException("Selection OAuth invalide ou expiree.");
    }

    return {
      provider: payload.provider,
      variant: payload.variant,
      accounts: payload.accounts.map((account) => ({
        externalAccountId: account.externalAccountId,
        displayName: account.displayName,
        handle: account.handle,
        accountType: account.accountType,
        publishCapability: account.publishCapability
      }))
    };
  }

  async completePendingSelection(
    userId: string,
    organizationId: string,
    selectionToken: string,
    externalAccountId: string
  ) {
    await this.organizationsService.assertMembership(organizationId, userId);
    const payload = this.decodePendingSelection(selectionToken);

    if (!payload || payload.organizationId !== organizationId || payload.userId !== userId || payload.expiresAt < Date.now()) {
      throw new BadRequestException("Selection OAuth invalide ou expiree.");
    }

    const account = payload.accounts.find((entry) => entry.externalAccountId === externalAccountId);

    if (!account) {
      throw new NotFoundException("Compte selectionne introuvable.");
    }

    return this.upsertAccount(userId, {
      organizationId,
      provider: account.provider,
      displayName: account.displayName,
      handle: account.handle,
      accountType: account.accountType,
      publishCapability: account.publishCapability,
      externalAccountId: account.externalAccountId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      tokenExpiresAt: account.tokenExpiresAt,
      metadata: account.metadata
    });
  }

  async disconnect(userId: string, organizationId: string, socialAccountId: string) {
    await this.organizationsService.assertMembership(organizationId, userId);

    const [account] = await this.databaseService.query<SocialAccountSummary & { provider: SocialProvider; handle: string }>(
      `
        update social_accounts
        set status = 'disconnected',
            access_token_encrypted = null,
            refresh_token_encrypted = null,
            token_expires_at = null,
            updated_at = now()
        where id = $1
          and organization_id = $2
        returning
          id,
          organization_id as "organizationId",
          provider,
          display_name as "displayName",
          handle,
          account_type as "accountType",
          publish_capability as "publishCapability",
          status,
          token_expires_at as "tokenExpiresAt"
      `,
      [socialAccountId, organizationId]
    );

    if (!account) {
      throw new NotFoundException("Compte social introuvable pour cette organisation.");
    }

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      entityType: "social_account",
      entityId: account.id,
      action: "social_account.updated",
      payload: {
        provider: account.provider,
        handle: account.handle,
        status: "disconnected"
      }
    });

    return account;
  }

  private async handleOAuthCallback(
    providerFamily: "linkedin" | "meta",
    params: {
      code?: string;
      state?: string;
      error?: string;
    }
  ): Promise<SocialConnectionRedirectResult> {
    if (params.error) {
      const state = params.state ? this.decodeOAuthState(params.state) : null;
      return this.buildRedirect(params.error === "access_denied" ? "cancelled" : "oauth_error", {
        provider: state?.provider ?? (providerFamily === "linkedin" ? "linkedin" : "facebook"),
        variant: state?.variant
      });
    }

    if (!params.code || !params.state) {
      return this.buildRedirect("invalid_state", {
        provider: providerFamily === "linkedin" ? "linkedin" : "facebook"
      });
    }

    const state = this.decodeOAuthState(params.state);

    if (
      !state ||
      state.expiresAt < Date.now() ||
      (providerFamily === "linkedin" && !state.variant.startsWith("linkedin_")) ||
      (providerFamily === "meta" && state.variant.startsWith("linkedin_"))
    ) {
      return this.buildRedirect("invalid_state", {
        provider: providerFamily === "linkedin" ? "linkedin" : "facebook"
      });
    }

    if (!this.isVariantConfigured(state.variant)) {
      return this.buildRedirect("provider_not_configured", { provider: state.provider, variant: state.variant });
    }

    try {
      await this.organizationsService.assertMembership(state.organizationId, state.userId);

      const accounts = await this.exchangeCodeForAccounts(state.variant, params.code);

      if (accounts.length === 0) {
        return this.buildRedirect("no_eligible_account", { provider: state.provider, variant: state.variant });
      }

      if (accounts.length > 1) {
        const selectionToken = this.encodePendingSelection({
          provider: state.provider,
          variant: state.variant,
          organizationId: state.organizationId,
          userId: state.userId,
          expiresAt: Date.now() + 10 * 60 * 1000,
          accounts
        });

        return this.buildRedirect("selection_required", {
          provider: state.provider,
          variant: state.variant,
          selectionToken
        });
      }

      const account = accounts[0];

      await this.upsertAccount(state.userId, {
        organizationId: state.organizationId,
        provider: account.provider,
        displayName: account.displayName,
        handle: account.handle,
        accountType: account.accountType,
        publishCapability: account.publishCapability,
        externalAccountId: account.externalAccountId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        tokenExpiresAt: account.tokenExpiresAt,
        metadata: account.metadata
      });

      return this.buildRedirect("success", { provider: state.provider, variant: state.variant });
    } catch (error) {
      if (error instanceof LinkedInOAuthServiceError) {
        return this.buildRedirect(error.status, { provider: state.provider, variant: state.variant });
      }

      return this.buildRedirect("unknown_error", { provider: state.provider, variant: state.variant });
    }
  }

  private async upsertAccount(userId: string, dto: CreateSocialAccountDto): Promise<SocialAccountSummary> {
    return this.databaseService.transaction(async (client) => {
      const [existingAccount] = await this.databaseService.query<{ id: string }>(
        `
          select id
          from social_accounts
          where organization_id = $1 and provider = $2 and external_account_id = $3
          limit 1
        `,
        [dto.organizationId, dto.provider, dto.externalAccountId],
        client
      );

      const params = [
        dto.organizationId,
        dto.provider,
        dto.displayName,
        dto.handle,
        dto.accountType,
        dto.publishCapability,
        dto.externalAccountId,
        dto.accessToken ? this.tokenCipherService.encrypt(dto.accessToken) : null,
        dto.refreshToken ? this.tokenCipherService.encrypt(dto.refreshToken) : null,
        dto.tokenExpiresAt ?? null,
        dto.accessToken ? "connected" : "disconnected",
        dto.metadata ?? {},
        userId
      ];

      const [account] = existingAccount
        ? await this.databaseService.query<SocialAccountSummary>(
            `
              update social_accounts
              set display_name = $3,
                  handle = $4,
                  account_type = $5,
                  publish_capability = $6,
                  access_token_encrypted = $8,
                  refresh_token_encrypted = $9,
                  token_expires_at = $10,
                  status = $11,
                  metadata = $12,
                  updated_at = now()
              where id = $14
              returning
                id,
                organization_id as "organizationId",
                provider,
                display_name as "displayName",
                handle,
                account_type as "accountType",
                publish_capability as "publishCapability",
                status,
                token_expires_at as "tokenExpiresAt"
            `,
            [...params, existingAccount.id],
            client
          )
        : await this.databaseService.query<SocialAccountSummary>(
            `
              insert into social_accounts (
                organization_id,
                provider,
                display_name,
                handle,
                account_type,
                publish_capability,
                external_account_id,
                access_token_encrypted,
                refresh_token_encrypted,
                token_expires_at,
                status,
                metadata,
                created_by_user_id
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              returning
                id,
                organization_id as "organizationId",
                provider,
                display_name as "displayName",
                handle,
                account_type as "accountType",
                publish_capability as "publishCapability",
                status,
                token_expires_at as "tokenExpiresAt"
            `,
            params,
            client
          );

      await this.auditService.record(
        {
          organizationId: dto.organizationId,
          actorUserId: userId,
          entityType: "social_account",
          entityId: account.id,
          action: existingAccount ? "social_account.updated" : "social_account.connected",
          payload: {
            provider: dto.provider,
            accountType: dto.accountType,
            publishCapability: dto.publishCapability,
            handle: dto.handle,
            externalAccountId: dto.externalAccountId
          }
        },
        client
      );

      return account;
    });
  }

  private getAuthorizationUrl(variant: SocialProviderConnectionVariant, state: string) {
    if (variant.startsWith("linkedin_")) {
      return this.linkedInOAuthService.getAuthorizationUrl(variant, state);
    }

    return this.metaOAuthService.getAuthorizationUrl(variant, state);
  }

  private async exchangeCodeForAccounts(variant: SocialProviderConnectionVariant, code: string) {
    if (variant.startsWith("linkedin_")) {
      return this.linkedInOAuthService.exchangeCodeForAccounts(code, variant);
    }

    return this.metaOAuthService.exchangeCodeForAccounts(code, variant);
  }

  private isVariantConfigured(variant: SocialProviderConnectionVariant) {
    if (variant.startsWith("linkedin_")) {
      return this.linkedInOAuthService.isConfiguredForVariant(variant);
    }

    return this.metaOAuthService.isConfigured();
  }

  private assertProviderVariant(provider: SocialProvider, variant: SocialProviderConnectionVariant) {
    const match = PROVIDER_VARIANTS.find((entry) => entry.provider === provider && entry.variant === variant);

    if (!match) {
      throw new BadRequestException("Variant de connexion incompatible avec ce provider.");
    }
  }

  private encodeOAuthState(payload: OAuthStatePayload) {
    return this.tokenCipherService.encrypt(JSON.stringify(payload));
  }

  private decodeOAuthState(payload: string): OAuthStatePayload | null {
    try {
      return JSON.parse(this.tokenCipherService.decrypt(payload)) as OAuthStatePayload;
    } catch {
      return null;
    }
  }

  private encodePendingSelection(payload: PendingSelectionPayload) {
    return this.tokenCipherService.encrypt(JSON.stringify(payload));
  }

  private decodePendingSelection(payload: string): PendingSelectionPayload | null {
    try {
      return JSON.parse(this.tokenCipherService.decrypt(payload)) as PendingSelectionPayload;
    } catch {
      return null;
    }
  }

  private buildRedirect(
    status: SocialConnectionCallbackStatus,
    options: {
      provider: SocialProvider;
      variant?: SocialProviderConnectionVariant;
      selectionToken?: string;
    }
  ): SocialConnectionRedirectResult {
    const redirectUrl = new URL("/social-accounts", this.configService.get("appWebUrl", { infer: true }));
    redirectUrl.searchParams.set("provider", options.provider);
    redirectUrl.searchParams.set("socialConnectionStatus", status);

    if (options.variant) {
      redirectUrl.searchParams.set("variant", options.variant);
    }

    if (options.selectionToken) {
      redirectUrl.searchParams.set("selectionToken", options.selectionToken);
    }

    return {
      status,
      redirectUrl: redirectUrl.toString()
    };
  }
}
