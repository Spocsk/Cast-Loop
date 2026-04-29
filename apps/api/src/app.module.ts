import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { getAppEnv } from "./config/env";

// Walk up from __dirname until we find a .env file (monorepo-layout agnostic).
const findMonorepoEnv = (): string | undefined => {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
};
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { HealthModule } from "./modules/health/health.module";
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
      envFilePath: findMonorepoEnv(),
      load: [getAppEnv]
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    AdminModule,
    AuthModule,
    HealthModule,
    OrganizationsModule,
    SocialAccountsModule,
    MediaModule,
    PostsModule,
    CalendarModule,
    PublishingModule
  ]
})
export class AppModule {}
