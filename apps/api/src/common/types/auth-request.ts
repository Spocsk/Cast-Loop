import { AuthenticatedAppUser, OrganizationRole } from "@cast-loop/shared";
import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  auth: {
    accessToken: string;
    appUser: AuthenticatedAppUser;
    memberships: Array<{
      organizationId: string;
      role: OrganizationRole;
    }>;
  };
}
