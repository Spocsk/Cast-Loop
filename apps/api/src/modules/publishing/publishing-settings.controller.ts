import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { SendTelegramTestMessageDto } from "./dto/send-telegram-test-message.dto";
import { PublishingSettingsService } from "./publishing-settings.service";

@Controller("settings")
@UseGuards(SupabaseAuthGuard)
export class PublishingSettingsController {
  constructor(private readonly publishingSettingsService: PublishingSettingsService) {}

  @Get("version")
  async getVersion() {
    return this.publishingSettingsService.getApiVersion();
  }

  @Post("telegram/test-message")
  async sendTelegramTestMessage(
    @CurrentUser() user: { id: string },
    @Body() dto: SendTelegramTestMessageDto
  ) {
    return this.publishingSettingsService.sendTelegramTestMessage(user.id, dto.organizationId);
  }
}
