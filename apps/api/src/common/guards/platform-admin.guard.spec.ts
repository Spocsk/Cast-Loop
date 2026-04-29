import { ForbiddenException } from "@nestjs/common";
import { PlatformAdminGuard } from "./platform-admin.guard";

const buildContext = (platformRole: "user" | "super_admin") =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        auth: {
          appUser: {
            platformRole
          }
        }
      })
    })
  }) as never;

describe("PlatformAdminGuard", () => {
  it("autorise les super-admins", () => {
    expect(new PlatformAdminGuard().canActivate(buildContext("super_admin"))).toBe(true);
  });

  it("refuse les utilisateurs standards", () => {
    expect(() => new PlatformAdminGuard().canActivate(buildContext("user"))).toThrow(ForbiddenException);
  });
});
