import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { AuthenticatedRequest } from "../../common/types/auth-request";
import { AuthService } from "./auth.service";
import { SetActiveOrganizationDto } from "./dto/set-active-organization.dto";
import { ValidateSessionDto } from "./dto/validate-session.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("session/validate")
  @UseGuards(SupabaseAuthGuard)
  async validateSession(@Body() body: ValidateSessionDto, @Req() request: AuthenticatedRequest) {
    return this.authService.validateSession(request.auth.accessToken, body.organizationId);
  }

  @Post("session/active-organization")
  @UseGuards(SupabaseAuthGuard)
  async setActiveOrganization(@Body() body: SetActiveOrganizationDto, @Req() request: AuthenticatedRequest) {
    return this.authService.setActiveOrganization(request.auth.accessToken, body.organizationId);
  }
}
