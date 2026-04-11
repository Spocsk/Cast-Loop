import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CreateOrganizationSocialAccountDto } from "./dto/create-organization-social-account.dto";
import { SocialAccountsService } from "./social-accounts.service";

@Controller("organizations/:id/social-accounts")
@UseGuards(SupabaseAuthGuard)
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get()
  async list(@Param("id") organizationId: string, @CurrentUser() user: { id: string }) {
    return this.socialAccountsService.listForOrganization(organizationId, user.id);
  }

  @Post()
  async create(
    @Param("id") organizationId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateOrganizationSocialAccountDto
  ) {
    return this.socialAccountsService.create(user.id, { ...dto, organizationId });
  }
}
