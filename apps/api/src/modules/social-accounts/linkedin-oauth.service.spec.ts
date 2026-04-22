import { LinkedInOAuthService } from "./linkedin-oauth.service";

describe("LinkedInOAuthService", () => {
  it("requests the publish scope for linkedin_page connections", () => {
    const service = new LinkedInOAuthService({
      get: jest.fn((key: string) => {
        switch (key) {
          case "linkedinOrgClientId":
            return "client-id";
          case "linkedinOrgClientSecret":
            return "client-secret";
          case "linkedinOrgRedirectUri":
            return "https://example.com/linkedin/callback";
          default:
            return "";
        }
      })
    } as never);

    const authorizationUrl = new URL(service.getAuthorizationUrl("linkedin_page", "state-123"));

    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "rw_organization_admin w_organization_social"
    );
  });
});
