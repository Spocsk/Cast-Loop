import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { DatabaseService } from "../../database/database.service";
import { SupabaseAdminService } from "../../database/supabase-admin.service";

describe("AuthService", () => {
  const buildService = (overrides: {
    getUser?: jest.Mock;
    query?: jest.Mock;
  } = {}) => {
    const getUser = overrides.getUser ?? jest.fn();
    const query = overrides.query ?? jest.fn();

    const db = { query } as unknown as DatabaseService;
    const admin = {
      client: { auth: { getUser } }
    } as unknown as SupabaseAdminService;

    return { service: new AuthService(db, admin), getUser, query };
  };

  it("rejette une session Supabase invalide", async () => {
    const { service } = buildService({
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error("bad token") })
    });

    await expect(service.authenticate("bad-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("upsert l'utilisateur puis retourne ses memberships", async () => {
    const userRow = {
      id: "user-1",
      auth_user_id: "auth-1",
      email: "alice@example.com",
      full_name: "Alice",
      avatar_url: null,
      active_organization_id: null,
            platform_role: "user",
            status: "active"
    };

    const query = jest
      .fn()
      .mockResolvedValueOnce([userRow])
      .mockResolvedValueOnce([{ organization_id: "org-1", role: "owner" }]);

    const { service } = buildService({
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "auth-1", email: "alice@example.com", user_metadata: { full_name: "Alice" } } },
        error: null
      }),
      query
    });

    const result = await service.authenticate("token");

    expect(result.appUser).toEqual({
      id: "user-1",
      authUserId: "auth-1",
      email: "alice@example.com",
      fullName: "Alice",
      avatarUrl: null,
      platformRole: "user",
      status: "active"
    });
    expect(result.memberships).toEqual([{ organizationId: "org-1", role: "owner" }]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  describe("validateSession", () => {
    it("retient l'organisation demandee si l'utilisateur y est membre", async () => {
      const { service, getUser, query } = buildService();
      getUser.mockResolvedValue({
        data: { user: { id: "auth-1", email: "a@b.c", user_metadata: {} } },
        error: null
      });
      query
        .mockResolvedValueOnce([
          {
            id: "user-1",
            auth_user_id: "auth-1",
            email: "a@b.c",
            full_name: null,
            avatar_url: null,
            active_organization_id: null,
            platform_role: "user",
            status: "active"
          }
        ])
        .mockResolvedValueOnce([
          { organization_id: "org-1", role: "owner" },
          { organization_id: "org-2", role: "editor" }
        ])
        .mockResolvedValueOnce([{ active_organization_id: null ,
            platform_role: "user",
            status: "active"}])
        .mockResolvedValueOnce([]);

      const res = await service.validateSession("t", "org-2");
      expect(res.activeOrganizationId).toBe("org-2");
    });

    it("retombe sur la premiere organisation si l'active n'est pas valide", async () => {
      const { service, getUser, query } = buildService();
      getUser.mockResolvedValue({
        data: { user: { id: "auth-1", email: "a@b.c", user_metadata: {} } },
        error: null
      });
      query
        .mockResolvedValueOnce([
          {
            id: "user-1",
            auth_user_id: "auth-1",
            email: "a@b.c",
            full_name: null,
            avatar_url: null,
            active_organization_id: null,
            platform_role: "user",
            status: "active"
          }
        ])
        .mockResolvedValueOnce([{ organization_id: "org-1", role: "owner" }])
        .mockResolvedValueOnce([{ active_organization_id: null ,
            platform_role: "user",
            status: "active"}])
        .mockResolvedValueOnce([]);

      const res = await service.validateSession("t", "org-inexistant");
      expect(res.activeOrganizationId).toBe("org-1");
    });

    it("retourne null quand l'utilisateur n'a aucune organisation", async () => {
      const { service, getUser, query } = buildService();
      getUser.mockResolvedValue({
        data: { user: { id: "auth-1", email: "a@b.c", user_metadata: {} } },
        error: null
      });
      query
        .mockResolvedValueOnce([
          {
            id: "user-1",
            auth_user_id: "auth-1",
            email: "a@b.c",
            full_name: null,
            avatar_url: null,
            active_organization_id: null,
            platform_role: "user",
            status: "active"
          }
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ active_organization_id: null ,
            platform_role: "user",
            status: "active"}]);

      const res = await service.validateSession("t");
      expect(res.activeOrganizationId).toBeNull();
    });

    it("retient l'organisation active persistee si elle est encore accessible", async () => {
      const { service, getUser, query } = buildService();
      getUser.mockResolvedValue({
        data: { user: { id: "auth-1", email: "a@b.c", user_metadata: {} } },
        error: null
      });
      query
        .mockResolvedValueOnce([
          {
            id: "user-1",
            auth_user_id: "auth-1",
            email: "a@b.c",
            full_name: null,
            avatar_url: null,
            active_organization_id: "org-2",
            platform_role: "user",
            status: "active"
          }
        ])
        .mockResolvedValueOnce([
          { organization_id: "org-1", role: "owner" },
          { organization_id: "org-2", role: "editor" }
        ])
        .mockResolvedValueOnce([{ active_organization_id: "org-2" ,
            platform_role: "user",
            status: "active"}]);

      const res = await service.validateSession("t");
      expect(res.activeOrganizationId).toBe("org-2");
    });
  });

  describe("setActiveOrganization", () => {
    it("met a jour l'organisation active si l'utilisateur y a acces", async () => {
      const { service, getUser, query } = buildService();
      getUser.mockResolvedValue({
        data: { user: { id: "auth-1", email: "a@b.c", user_metadata: {} } },
        error: null
      });
      query
        .mockResolvedValueOnce([
          {
            id: "user-1",
            auth_user_id: "auth-1",
            email: "a@b.c",
            full_name: null,
            avatar_url: null,
            active_organization_id: null,
            platform_role: "user",
            status: "active"
          }
        ])
        .mockResolvedValueOnce([
          { organization_id: "org-1", role: "owner" },
          { organization_id: "org-2", role: "editor" }
        ])
        .mockResolvedValueOnce([]);

      const res = await service.setActiveOrganization("t", "org-2");

      expect(res.activeOrganizationId).toBe("org-2");
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining("update users"),
        ["org-2", "user-1"]
      );
    });
  });
});
