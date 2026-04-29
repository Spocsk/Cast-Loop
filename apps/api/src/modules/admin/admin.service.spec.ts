import { AdminService } from "./admin.service";

describe("AdminService", () => {
  it("reinitialise toutes les connexions sociales d'une entreprise", async () => {
    const query = jest.fn().mockResolvedValue([{ id: "account-1" }, { id: "account-2" }]);
    const service = new AdminService(
      { query } as never,
      { client: { auth: { admin: {} } } } as never
    );

    const result = await service.resetSocialConnections("org-1");

    expect(query).toHaveBeenCalledWith(expect.stringContaining("update social_accounts"), ["org-1"]);
    expect(result).toEqual({
      organizationId: "org-1",
      resetCount: 2
    });
  });
});
