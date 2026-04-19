import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CompleteSocialAccountSelectionDto } from "./dto/complete-social-account-selection.dto";
import { CreateOrganizationSocialAccountDto } from "./dto/create-organization-social-account.dto";
import { StartSocialConnectionDto } from "./dto/start-social-connection.dto";
import { SocialAccountsService } from "./social-accounts.service";

@Controller("organizations/:id/social-accounts")
@UseGuards(SupabaseAuthGuard)
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get()
  async list(@Param("id") organizationId: string, @CurrentUser() user: { id: string }) {
    return this.socialAccountsService.listForOrganization(organizationId, user.id);
  }

  @Get("providers")
  async listProviders(@Param("id") organizationId: string, @CurrentUser() user: { id: string }) {
    return this.socialAccountsService.listProviderAvailability(organizationId, user.id);
  }

  @Post(":provider/start")
  async startConnection(
    @Param("id") organizationId: string,
    @Param("provider") provider: "facebook" | "instagram" | "linkedin",
    @CurrentUser() user: { id: string },
    @Body() dto: StartSocialConnectionDto
  ) {
    return this.socialAccountsService.startConnection(user.id, organizationId, provider, dto);
  }

  @Get("pending-selection")
  async getPendingSelection(
    @Param("id") organizationId: string,
    @CurrentUser() user: { id: string },
    @Query("selectionToken") selectionToken: string
  ) {
    return this.socialAccountsService.getPendingSelection(user.id, organizationId, selectionToken);
  }

  @Post("pending-selection/complete")
  async completePendingSelection(
    @Param("id") organizationId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CompleteSocialAccountSelectionDto
  ) {
    return this.socialAccountsService.completePendingSelection(
      user.id,
      organizationId,
      dto.selectionToken,
      dto.externalAccountId
    );
  }

  @Delete(":accountId")
  async disconnect(
    @Param("id") organizationId: string,
    @Param("accountId") socialAccountId: string,
    @CurrentUser() user: { id: string }
  ) {
    return this.socialAccountsService.disconnect(user.id, organizationId, socialAccountId);
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
