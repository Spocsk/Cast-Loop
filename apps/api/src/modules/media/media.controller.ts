import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
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

  @Post("upload-url")
  async createUploadUrl(@CurrentUser() user: { id: string }, @Body() dto: CreateUploadUrlDto) {
    return this.mediaService.createUploadUrl(user.id, dto);
  }
}
