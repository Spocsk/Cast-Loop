import {
  SocialAccountCapability,
  SocialAccountType,
  SocialProviderConnectionVariant
} from "@cast-loop/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppEnv } from "../../config/env";

export interface NormalizedSocialAccount {
  provider: "facebook" | "instagram" | "linkedin";
  accountType: SocialAccountType;
  publishCapability: SocialAccountCapability;
  externalAccountId: string;
  displayName: string;
  handle: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  metadata: Record<string, unknown>;
}

interface LinkedInTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

interface LinkedInOrganizationAclResponse {
  elements?: Array<{
    organization?: string;
  }>;
}

interface LinkedInOrganizationResponse {
  id?: number | string;
  localizedName?: string;
  vanityName?: string;
  name?: string | { localized?: Record<string, string> };
}

interface LinkedInUserInfoResponse {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
  locale?: {
    country?: string;
    language?: string;
  };
}

export class LinkedInOAuthServiceError extends Error {
  constructor(
    readonly status:
      | "provider_not_configured"
      | "oauth_error"
      | "no_eligible_account"
      | "unknown_error",
    message: string
  ) {
    super(message);
  }
}

@Injectable()
export class LinkedInOAuthService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  isConfiguredForVariant(variant: SocialProviderConnectionVariant) {
    if (variant === "linkedin_personal") {
      return Boolean(
        this.configService.get("linkedinMemberClientId", { infer: true }) &&
          this.configService.get("linkedinMemberClientSecret", { infer: true }) &&
          this.configService.get("linkedinMemberRedirectUri", { infer: true })
      );
    }

    if (variant === "linkedin_page") {
      return Boolean(
        this.configService.get("linkedinOrgClientId", { infer: true }) &&
          this.configService.get("linkedinOrgClientSecret", { infer: true }) &&
          this.configService.get("linkedinOrgRedirectUri", { infer: true })
      );
    }

    return false;
  }

  getAuthorizationUrl(variant: SocialProviderConnectionVariant, state: string) {
    if (!this.isConfiguredForVariant(variant)) {
      throw new LinkedInOAuthServiceError(
        "provider_not_configured",
        "LinkedIn n'est pas configure pour ce parcours."
      );
    }

    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);

    if (variant === "linkedin_personal") {
      url.searchParams.set("client_id", this.configService.get("linkedinMemberClientId", { infer: true }));
      url.searchParams.set(
        "redirect_uri",
        this.configService.get("linkedinMemberRedirectUri", { infer: true })
      );
      url.searchParams.set("scope", "openid profile w_member_social");
      return url.toString();
    }

    url.searchParams.set("client_id", this.configService.get("linkedinOrgClientId", { infer: true }));
    url.searchParams.set("redirect_uri", this.configService.get("linkedinOrgRedirectUri", { infer: true }));
    url.searchParams.set("scope", "rw_organization_admin w_organization_social");
    return url.toString();
  }

  async exchangeCodeForAccounts(
    code: string,
    variant: SocialProviderConnectionVariant
  ): Promise<NormalizedSocialAccount[]> {
    if (variant === "linkedin_personal") {
      return [await this.exchangeCodeForPersonalAccount(code)];
    }

    if (variant === "linkedin_page") {
      return this.exchangeCodeForPageAccounts(code);
    }

    return [];
  }

  private async exchangeCodeForPersonalAccount(code: string): Promise<NormalizedSocialAccount> {
    const token = await this.exchangeCodeForToken(code, "linkedin_personal");
    const userInfo = await this.fetchUserInfo(token.access_token);
    const personId = userInfo.sub;

    if (!personId) {
      throw new LinkedInOAuthServiceError("oauth_error", "Impossible de resoudre le profil LinkedIn.");
    }

    const displayName = [userInfo.given_name, userInfo.family_name].filter(Boolean).join(" ").trim() || userInfo.name || "Profil LinkedIn";

    return {
      provider: "linkedin",
      accountType: "personal",
      publishCapability: "publishable",
      externalAccountId: personId,
      displayName,
      handle: `linkedin-member-${personId}`,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt:
        typeof token.expires_in === "number"
          ? new Date(Date.now() + token.expires_in * 1000).toISOString()
          : undefined,
      metadata: {
        linkedinPersonId: personId,
        linkedinPersonUrn: `urn:li:person:${personId}`,
        profilePictureUrl: userInfo.picture ?? null,
        locale: userInfo.locale ?? null
      }
    };
  }

  private async exchangeCodeForPageAccounts(code: string): Promise<NormalizedSocialAccount[]> {
    const token = await this.exchangeCodeForToken(code, "linkedin_page");
    const organizationIds = await this.fetchEligibleOrganizationIds(token.access_token);

    if (organizationIds.length === 0) {
      throw new LinkedInOAuthServiceError(
        "no_eligible_account",
        "Aucune page LinkedIn eligible n'a ete trouvee."
      );
    }

    const organizations = await Promise.all(
      organizationIds.sort((left, right) => left.localeCompare(right)).map(async (organizationId) => {
        const organization = await this.fetchOrganization(token.access_token, organizationId);

        return {
          provider: "linkedin" as const,
          accountType: "page" as const,
          publishCapability: "publishable" as const,
          externalAccountId: organizationId,
          displayName: organization.displayName,
          handle: organization.handle,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          tokenExpiresAt:
            typeof token.expires_in === "number"
              ? new Date(Date.now() + token.expires_in * 1000).toISOString()
              : undefined,
          metadata: {
            linkedinOrganizationId: organizationId,
            linkedinOrganizationUrn: `urn:li:organization:${organizationId}`,
            linkedinApiVersion: this.configService.get("linkedinApiVersion", { infer: true }) || null,
            vanityName: organization.vanityName ?? null
          }
        };
      })
    );

    return organizations;
  }

  private async exchangeCodeForToken(code: string, variant: "linkedin_personal" | "linkedin_page") {
    const clientId =
      variant === "linkedin_personal"
        ? this.configService.get("linkedinMemberClientId", { infer: true })
        : this.configService.get("linkedinOrgClientId", { infer: true });
    const clientSecret =
      variant === "linkedin_personal"
        ? this.configService.get("linkedinMemberClientSecret", { infer: true })
        : this.configService.get("linkedinOrgClientSecret", { infer: true });
    const redirectUri =
      variant === "linkedin_personal"
        ? this.configService.get("linkedinMemberRedirectUri", { infer: true })
        : this.configService.get("linkedinOrgRedirectUri", { infer: true });

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readErrorMessage(response));
    }

    return (await response.json()) as LinkedInTokenResponse;
  }

  private async fetchUserInfo(accessToken: string) {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readErrorMessage(response));
    }

    return (await response.json()) as LinkedInUserInfoResponse;
  }

  private async fetchEligibleOrganizationIds(accessToken: string) {
    const response = await fetch(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
      {
        headers: this.buildLinkedInHeaders(accessToken)
      }
    );

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readErrorMessage(response));
    }

    const payload = (await response.json()) as LinkedInOrganizationAclResponse;

    return (payload.elements ?? [])
      .map((entry) => entry.organization)
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => entry.split(":").at(-1) ?? entry);
  }

  private async fetchOrganization(accessToken: string, organizationId: string) {
    const response = await fetch(`https://api.linkedin.com/rest/organizations/${organizationId}`, {
      headers: this.buildLinkedInHeaders(accessToken)
    });

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readErrorMessage(response));
    }

    const payload = (await response.json()) as LinkedInOrganizationResponse;
    const displayName = pickOrganizationName(payload);

    return {
      displayName,
      handle: payload.vanityName ? `@${payload.vanityName}` : `linkedin-${organizationId}`,
      vanityName: payload.vanityName ?? null
    };
  }

  private buildLinkedInHeaders(accessToken: string) {
    const version = this.configService.get("linkedinApiVersion", { infer: true });

    return {
      Authorization: `Bearer ${accessToken}`,
      ...(version ? { "LinkedIn-Version": version } : {}),
      "X-Restli-Protocol-Version": "2.0.0",
      Accept: "application/json"
    };
  }
}

const pickOrganizationName = (payload: LinkedInOrganizationResponse) => {
  if (payload.localizedName) {
    return payload.localizedName;
  }

  if (typeof payload.name === "string" && payload.name.trim()) {
    return payload.name;
  }

  const localized = payload.name && typeof payload.name === "object" ? payload.name.localized : undefined;
  const localizedValue = localized ? Object.values(localized).find((value) => value.trim().length > 0) : null;

  if (localizedValue) {
    return localizedValue;
  }

  return `LinkedIn organization ${payload.id ?? ""}`.trim();
};

const readErrorMessage = async (response: Response) => {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as {
      error_description?: string;
      message?: string;
      error?: string;
    };

    return payload.error_description ?? payload.message ?? payload.error ?? text ?? `LinkedIn error ${response.status}`;
  } catch {
    return text || `LinkedIn error ${response.status}`;
  }
};
