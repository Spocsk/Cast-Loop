import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(SupabaseAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }, @Query("organizationId") organizationId: string) {
    return this.mediaService.listForOrganization(organizationId, user.id);
  }

  @Get(":id/view-url")
  async createViewUrl(
    @CurrentUser() user: { id: string },
    @Param("id") assetId: string,
    @Query("organizationId") organizationId: string
  ) {
    return this.mediaService.createViewUrl(user.id, organizationId, assetId);
  }

  @Post("upload-url")
  async createUploadUrl(@CurrentUser() user: { id: string }, @Body() dto: CreateUploadUrlDto) {
    return this.mediaService.createUploadUrl(user.id, dto);
  }
}
