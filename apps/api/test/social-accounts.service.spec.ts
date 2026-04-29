import { BadRequestException } from "@nestjs/common";
import { SocialAccountsService } from "../src/modules/social-accounts/social-accounts.service";
import { LinkedInOAuthServiceError } from "../src/modules/social-accounts/linkedin-oauth.service";

const ORG_ID = "8fe2d17d-b0f0-4f87-8f30-e10d2da3521e";
const USER_ID = "f1111111-1111-4111-8111-111111111111";

type QueryMock = jest.Mock;

const buildService = (queryImpl: (sql: string, params?: unknown[]) => unknown[] | Promise<unknown[]>) => {
  const query: QueryMock = jest.fn((sql: string, params?: unknown[]) => Promise.resolve(queryImpl(sql, params)));
  const transaction = jest.fn(async (callback: (client: unknown) => Promise<unknown>) => callback({}));
  const organizationsService = { assertPermission: jest.fn().mockResolvedValue({ organization_id: ORG_ID, role: "owner" }) };
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const tokenCipherService = {
    encrypt: jest.fn((value: string) => `enc:${value}`),
    decrypt: jest.fn((value: string) => value.replace(/^enc:/, ""))
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "appWebUrl") return "http://localhost:3001";
      return "";
    })
  };
  const linkedInOAuthService = {
    isConfiguredForVariant: jest.fn().mockReturnValue(true),
    getAuthorizationUrl: jest.fn((variant: string, state: string) => `https://linkedin.example/auth?variant=${variant}&state=${encodeURIComponent(state)}`),
    exchangeCodeForAccounts: jest.fn()
  };
  const metaOAuthService = {
    isConfigured: jest.fn().mockReturnValue(true),
    getAuthorizationUrl: jest.fn((variant: string, state: string) => `https://meta.example/auth?variant=${variant}&state=${encodeURIComponent(state)}`),
    exchangeCodeForAccounts: jest.fn()
  };

  const service = new SocialAccountsService(
    { query, transaction } as never,
    organizationsService as never,
    auditService as never,
    tokenCipherService as never,
    configService as never,
    linkedInOAuthService as never,
    metaOAuthService as never
  );

  return {
    service,
    query,
    transaction,
    organizationsService,
    auditService,
    tokenCipherService,
    configService,
    linkedInOAuthService,
    metaOAuthService
  };
};

describe("SocialAccountsService.startConnection", () => {
  it("returns an authorization url for a configured provider", async () => {
    const { service, linkedInOAuthService } = buildService(() => []);

    const result = await service.startConnection(USER_ID, ORG_ID, "linkedin", {
      variant: "linkedin_page"
    });

    expect(result.provider).toBe("linkedin");
    expect(result.variant).toBe("linkedin_page");
    expect(linkedInOAuthService.getAuthorizationUrl).toHaveBeenCalled();
  });

  it("rejects when linkedin is not configured", async () => {
    const { service, linkedInOAuthService } = buildService(() => []);
    linkedInOAuthService.isConfiguredForVariant.mockReturnValue(false);

    await expect(
      service.startConnection(USER_ID, ORG_ID, "linkedin", { variant: "linkedin_page" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SocialAccountsService.handleLinkedInCallback", () => {
  it("returns invalid_state when state cannot be decoded", async () => {
    const { service, tokenCipherService } = buildService(() => []);
    tokenCipherService.decrypt.mockImplementation(() => {
      throw new Error("boom");
    });

    const result = await service.handleLinkedInCallback({
      code: "code",
      state: "enc:bad"
    });

    expect(result.status).toBe("invalid_state");
    expect(result.redirectUrl).toContain("socialConnectionStatus=invalid_state");
  });

  it("creates a connected social account on successful callback", async () => {
    const { service, linkedInOAuthService, auditService } = buildService((sql) => {
      if (sql.includes("where organization_id = $1 and provider = $2 and external_account_id = $3")) {
        return [];
      }
      if (sql.includes("insert into social_accounts")) {
        return [
          {
            id: "account-1",
            organizationId: ORG_ID,
            provider: "linkedin",
            displayName: "Cast Loop",
            handle: "@castloop",
            accountType: "page",
            publishCapability: "publishable",
            status: "connected",
            tokenExpiresAt: "2030-01-01T10:00:00.000Z"
          }
        ];
      }
      return [];
    });

    linkedInOAuthService.exchangeCodeForAccounts.mockResolvedValue([
      {
        provider: "linkedin",
        accountType: "page",
        publishCapability: "publishable",
        externalAccountId: "li-org-1",
        displayName: "Cast Loop",
        handle: "@castloop",
        accessToken: "token",
        tokenExpiresAt: "2030-01-01T10:00:00.000Z",
        metadata: { linkedinOrganizationId: "li-org-1" }
      }
    ]);

    const state = `enc:${JSON.stringify({
      provider: "linkedin",
      variant: "linkedin_page",
      organizationId: ORG_ID,
      userId: USER_ID,
      expiresAt: Date.now() + 10000
    })}`;

    const result = await service.handleLinkedInCallback({
      code: "good-code",
      state
    });

    expect(result.status).toBe("success");
    expect(auditService.record).toHaveBeenCalled();
  });

  it("updates an existing account instead of duplicating it", async () => {
    const { service, linkedInOAuthService } = buildService((sql) => {
      if (sql.includes("where organization_id = $1 and provider = $2 and external_account_id = $3")) {
        return [{ id: "account-1" }];
      }
      if (sql.includes("update social_accounts")) {
        return [
          {
            id: "account-1",
            organizationId: ORG_ID,
            provider: "linkedin",
            displayName: "Cast Loop",
            handle: "@castloop",
            accountType: "page",
            publishCapability: "publishable",
            status: "connected",
            tokenExpiresAt: "2030-01-01T10:00:00.000Z"
          }
        ];
      }
      return [];
    });

    linkedInOAuthService.exchangeCodeForAccounts.mockResolvedValue([
      {
        provider: "linkedin",
        accountType: "page",
        publishCapability: "publishable",
        externalAccountId: "li-org-1",
        displayName: "Cast Loop",
        handle: "@castloop",
        accessToken: "token",
        tokenExpiresAt: "2030-01-01T10:00:00.000Z",
        metadata: { linkedinOrganizationId: "li-org-1" }
      }
    ]);

    const state = `enc:${JSON.stringify({
      provider: "linkedin",
      variant: "linkedin_page",
      organizationId: ORG_ID,
      userId: USER_ID,
      expiresAt: Date.now() + 10000
    })}`;

    const result = await service.handleLinkedInCallback({
      code: "good-code",
      state
    });

    expect(result.status).toBe("success");
  });

  it("maps linkedin no_eligible_account errors to a redirect status", async () => {
    const { service, linkedInOAuthService } = buildService(() => []);

    linkedInOAuthService.exchangeCodeForAccounts.mockRejectedValue(
      new LinkedInOAuthServiceError("no_eligible_account", "none")
    );

    const state = `enc:${JSON.stringify({
      provider: "linkedin",
      variant: "linkedin_page",
      organizationId: ORG_ID,
      userId: USER_ID,
      expiresAt: Date.now() + 10000
    })}`;

    const result = await service.handleLinkedInCallback({
      code: "good-code",
      state
    });

    expect(result.status).toBe("no_eligible_account");
  });

  it("returns selection_required when multiple accounts are available", async () => {
    const { service, linkedInOAuthService } = buildService(() => []);

    linkedInOAuthService.exchangeCodeForAccounts.mockResolvedValue([
      {
        provider: "linkedin",
        accountType: "page",
        publishCapability: "publishable",
        externalAccountId: "li-org-1",
        displayName: "Cast Loop",
        handle: "@castloop",
        accessToken: "token",
        metadata: {}
      },
      {
        provider: "linkedin",
        accountType: "page",
        publishCapability: "publishable",
        externalAccountId: "li-org-2",
        displayName: "Cast Loop 2",
        handle: "@castloop-2",
        accessToken: "token",
        metadata: {}
      }
    ]);

    const state = `enc:${JSON.stringify({
      provider: "linkedin",
      variant: "linkedin_page",
      organizationId: ORG_ID,
      userId: USER_ID,
      expiresAt: Date.now() + 10000
    })}`;

    const result = await service.handleLinkedInCallback({
      code: "good-code",
      state
    });

    expect(result.status).toBe("selection_required");
    expect(result.redirectUrl).toContain("selectionToken=");
  });
});
