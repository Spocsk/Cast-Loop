import {
  SocialProviderConnectionVariant
} from "@cast-loop/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppEnv } from "../../config/env";
import { LinkedInOAuthServiceError, NormalizedSocialAccount } from "./linkedin-oauth.service";

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface MetaPageResponse {
  id?: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id?: string;
    name?: string;
    username?: string;
  };
  connected_instagram_account?: {
    id?: string;
    name?: string;
    username?: string;
  };
}

interface MetaAccountsResponse {
  data?: MetaPageResponse[];
}

interface MetaUserResponse {
  id?: string;
  name?: string;
}

interface InstagramAccountResponse {
  id?: string;
  username?: string;
  name?: string;
  account_type?: string;
}

@Injectable()
export class MetaOAuthService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  isConfigured() {
    return Boolean(
      this.configService.get("metaAppId", { infer: true }) &&
        this.configService.get("metaAppSecret", { infer: true }) &&
        this.configService.get("metaRedirectUri", { infer: true })
    );
  }

  getAuthorizationUrl(variant: SocialProviderConnectionVariant, state: string) {
    if (!this.isConfigured()) {
      throw new LinkedInOAuthServiceError("provider_not_configured", "Meta n'est pas configure sur le serveur.");
    }

    const url = new URL(
      `https://www.facebook.com/${this.configService.get("metaApiVersion", { infer: true })}/dialog/oauth`
    );
    url.searchParams.set("client_id", this.configService.get("metaAppId", { infer: true }));
    url.searchParams.set("redirect_uri", this.configService.get("metaRedirectUri", { infer: true }));
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", getMetaScopes(variant));
    return url.toString();
  }

  async exchangeCodeForAccounts(
    code: string,
    variant: SocialProviderConnectionVariant
  ): Promise<NormalizedSocialAccount[]> {
    const shortLived = await this.exchangeCodeForUserToken(code);
    const longLived = await this.exchangeForLongLivedUserToken(shortLived.access_token);

    if (variant === "meta_personal") {
      return [await this.fetchMetaPersonalAccount(longLived)];
    }

    const pages = await this.fetchPages(longLived.access_token);

    if (variant === "facebook_page") {
      return pages
        .filter((page) => page.id && page.name && page.access_token)
        .map((page) => ({
          provider: "facebook" as const,
          accountType: "page" as const,
          publishCapability: "publishable" as const,
          externalAccountId: page.id!,
          displayName: page.name!,
          handle: `facebook-page-${page.id}`,
          accessToken: page.access_token!,
          metadata: {
            facebookPageId: page.id,
            pageTasks: page.tasks ?? []
          }
        }));
    }

    if (variant === "instagram_professional") {
      const instagramAccounts = await Promise.all(
        pages.flatMap((page) => {
          const instagramAccount = page.instagram_business_account ?? page.connected_instagram_account;

          if (!instagramAccount?.id) {
            return [];
          }

          return [
            this.fetchInstagramAccount(longLived.access_token, instagramAccount.id, page.id ?? null).then((account) => ({
              provider: "instagram" as const,
              accountType: account.accountType,
              publishCapability: "publishable" as const,
              externalAccountId: account.id,
              displayName: account.displayName,
              handle: account.handle,
              accessToken: longLived.access_token,
              tokenExpiresAt: buildMetaExpiration(longLived.expires_in),
              metadata: {
                instagramAccountId: account.id,
                connectedFacebookPageId: page.id ?? null
              }
            }))
          ];
        })
      );

      return instagramAccounts;
    }

    return [];
  }

  private async exchangeCodeForUserToken(code: string) {
    const response = await fetch(
      `https://graph.facebook.com/${this.configService.get("metaApiVersion", { infer: true })}/oauth/access_token?${new URLSearchParams(
        {
          client_id: this.configService.get("metaAppId", { infer: true }),
          client_secret: this.configService.get("metaAppSecret", { infer: true }),
          redirect_uri: this.configService.get("metaRedirectUri", { infer: true }),
          code
        }
      ).toString()}`
    );

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readMetaError(response));
    }

    return (await response.json()) as MetaTokenResponse;
  }

  private async exchangeForLongLivedUserToken(accessToken: string) {
    const response = await fetch(
      `https://graph.facebook.com/${this.configService.get("metaApiVersion", { infer: true })}/oauth/access_token?${new URLSearchParams(
        {
          grant_type: "fb_exchange_token",
          client_id: this.configService.get("metaAppId", { infer: true }),
          client_secret: this.configService.get("metaAppSecret", { infer: true }),
          fb_exchange_token: accessToken
        }
      ).toString()}`
    );

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readMetaError(response));
    }

    return (await response.json()) as MetaTokenResponse;
  }

  private async fetchMetaPersonalAccount(token: MetaTokenResponse): Promise<NormalizedSocialAccount> {
    const response = await fetch(
      `https://graph.facebook.com/${this.configService.get("metaApiVersion", { infer: true })}/me?fields=id,name&access_token=${encodeURIComponent(
        token.access_token
      )}`
    );

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readMetaError(response));
    }

    const user = (await response.json()) as MetaUserResponse;

    if (!user.id || !user.name) {
      throw new LinkedInOAuthServiceError("oauth_error", "Impossible de resoudre le profil Meta personnel.");
    }

    return {
      provider: "facebook",
      accountType: "personal",
      publishCapability: "connect_only",
      externalAccountId: user.id,
      displayName: user.name,
      handle: `facebook-user-${user.id}`,
      accessToken: token.access_token,
      tokenExpiresAt: buildMetaExpiration(token.expires_in),
      metadata: {
        facebookUserId: user.id
      }
    };
  }

  private async fetchPages(accessToken: string) {
    const response = await fetch(
      `https://graph.facebook.com/${this.configService.get("metaApiVersion", { infer: true })}/me/accounts?${new URLSearchParams(
        {
          fields:
            "id,name,access_token,tasks,instagram_business_account{id,name,username},connected_instagram_account{id,name,username}",
          access_token: accessToken
        }
      ).toString()}`
    );

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readMetaError(response));
    }

    const payload = (await response.json()) as MetaAccountsResponse;
    const pages = payload.data ?? [];

    if (pages.length === 0) {
      throw new LinkedInOAuthServiceError("no_eligible_account", "Aucun compte Meta eligible n'a ete trouve.");
    }

    return pages;
  }

  private async fetchInstagramAccount(accessToken: string, accountId: string, pageId: string | null) {
    const response = await fetch(
      `https://graph.facebook.com/${this.configService.get("metaApiVersion", { infer: true })}/${accountId}?${new URLSearchParams(
        {
          fields: "id,username,name,account_type",
          access_token: accessToken
        }
      ).toString()}`
    );

    if (!response.ok) {
      throw new LinkedInOAuthServiceError("oauth_error", await readMetaError(response));
    }

    const account = (await response.json()) as InstagramAccountResponse;

    return {
      id: account.id ?? accountId,
      displayName: account.name ?? account.username ?? `Instagram ${accountId}`,
      handle: account.username ? `@${account.username}` : `instagram-${accountId}`,
      accountType: normalizeInstagramAccountType(account.account_type),
      pageId
    };
  }
}

const getMetaScopes = (variant: SocialProviderConnectionVariant) => {
  if (variant === "meta_personal") {
    return "public_profile";
  }

  if (variant === "facebook_page") {
    return "public_profile,pages_show_list,pages_manage_posts,pages_read_engagement";
  }

  if (variant === "instagram_professional") {
    return "public_profile,pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish";
  }

  return "public_profile";
};

const normalizeInstagramAccountType = (accountType?: string) => {
  if (accountType?.toUpperCase() === "CREATOR") {
    return "creator" as const;
  }

  return "business" as const;
};

const buildMetaExpiration = (expiresIn?: number) =>
  typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;

const readMetaError = async (response: Response) => {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as {
      error?: {
        message?: string;
      };
    };

    return payload.error?.message ?? text ?? `Meta error ${response.status}`;
  } catch {
    return text || `Meta error ${response.status}`;
  }
};
