import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(SupabaseAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("upload-url")
  async createUploadUrl(@CurrentUser() user: { id: string }, @Body() dto: CreateUploadUrlDto) {
    return this.mediaService.createUploadUrl(user.id, dto);
  }
}
