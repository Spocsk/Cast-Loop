import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../../common/guards/platform-admin.guard";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { AuthenticatedRequest } from "../../common/types/auth-request";
import { AdminService } from "./admin.service";
import { AdminCreateOrganizationDto, AdminUpdateOrganizationDto } from "./dto/admin-organization.dto";
import { AdminCreateUserDto, AdminUpdateUserDto } from "./dto/admin-user.dto";

@Controller("admin")
@UseGuards(SupabaseAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Post("users")
  async createUser(@Req() request: AuthenticatedRequest, @Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(request.auth.appUser.id, dto);
  }

  @Patch("users/:id")
  async updateUser(@Param("id") userId: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(userId, dto);
  }

  @Delete("users/:id")
  async deleteUser(
    @Req() request: AuthenticatedRequest,
    @Param("id") userId: string,
    @Query("hard") hard?: string
  ) {
    return this.adminService.deleteUser(request.auth.appUser.id, userId, hard === "true");
  }

  @Post("users/:id/reset-password")
  async resetPassword(@Param("id") userId: string) {
    return this.adminService.resetPassword(userId);
  }

  @Get("organizations")
  async listOrganizations() {
    return this.adminService.listOrganizations();
  }

  @Post("organizations")
  async createOrganization(@Req() request: AuthenticatedRequest, @Body() dto: AdminCreateOrganizationDto) {
    return this.adminService.createOrganization(request.auth.appUser.id, dto);
  }

  @Patch("organizations/:id")
  async updateOrganization(@Param("id") organizationId: string, @Body() dto: AdminUpdateOrganizationDto) {
    return this.adminService.updateOrganization(organizationId, dto);
  }

  @Delete("organizations/:id")
  async deleteOrganization(@Param("id") organizationId: string, @Query("hard") hard?: string) {
    return this.adminService.deleteOrganization(organizationId, hard === "true");
  }

  @Post("organizations/:id/reset-social-connections")
  async resetSocialConnections(@Param("id") organizationId: string) {
    return this.adminService.resetSocialConnections(organizationId);
  }
}
