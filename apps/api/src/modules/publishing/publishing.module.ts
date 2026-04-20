import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../../database/database.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PostsModule } from "../posts/posts.module";
import { PublishingSettingsController } from "./publishing-settings.controller";
import { PublishingSettingsService } from "./publishing-settings.service";
import { PublishingService } from "./publishing.service";
import { TelegramNotifierService } from "./telegram-notifier.service";

@Module({
  imports: [AuthModule, PostsModule, OrganizationsModule, DatabaseModule, ConfigModule],
  controllers: [PublishingSettingsController],
  providers: [PublishingService, PublishingSettingsService, TelegramNotifierService],
  exports: [PublishingService]
})
export class PublishingModule {}
