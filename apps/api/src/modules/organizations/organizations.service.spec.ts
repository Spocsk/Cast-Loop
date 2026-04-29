import { ForbiddenException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "./organizations.service";

describe("OrganizationsService RBAC", () => {
  const buildService = (role: "owner" | "admin" | "manager" | "editor" | null) => {
    const query = jest.fn().mockResolvedValue(
      role
        ? [
            {
              organization_id: "org-1",
              role
            }
          ]
        : []
    );

    const service = new OrganizationsService(
      { query } as unknown as DatabaseService,
      { record: jest.fn() } as unknown as AuditService
    );

    return { service, query };
  };

  it("autorise une permission presente dans le role", async () => {
    const { service } = buildService("manager");

    await expect(service.assertPermission("org-1", "user-1", "posts.publish")).resolves.toEqual({
      organization_id: "org-1",
      role: "manager"
    });
  });

  it("refuse une permission absente du role", async () => {
    const { service } = buildService("editor");

    await expect(service.assertPermission("org-1", "user-1", "posts.publish")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
