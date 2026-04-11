import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { getAppEnv } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { MediaModule } from "./modules/media/media.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { PostsModule } from "./modules/posts/posts.module";
import { PublishingModule } from "./modules/publishing/publishing.module";
import { SocialAccountsModule } from "./modules/social-accounts/social-accounts.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [getAppEnv]
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    SocialAccountsModule,
    MediaModule,
    PostsModule,
    CalendarModule,
    PublishingModule
  ]
})
export class AppModule {}
