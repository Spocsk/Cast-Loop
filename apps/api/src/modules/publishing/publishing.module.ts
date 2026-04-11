import { Module } from "@nestjs/common";
import { PostsModule } from "../posts/posts.module";
import { PublishingService } from "./publishing.service";

@Module({
  imports: [PostsModule],
  providers: [PublishingService],
  exports: [PublishingService]
})
export class PublishingModule {}
