import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "../types/auth-request";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.auth.appUser.platformRole !== "super_admin") {
      throw new ForbiddenException("Acces reserve aux super-admins.");
    }

    return true;
  }
}
