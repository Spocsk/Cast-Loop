import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PostsModule } from "../posts/posts.module";
import { PublishingService } from "./publishing.service";
import { TelegramNotifierService } from "./telegram-notifier.service";

@Module({
  imports: [PostsModule, ConfigModule],
  providers: [PublishingService, TelegramNotifierService],
  exports: [PublishingService]
})
export class PublishingModule {}
