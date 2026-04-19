import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { LinkedInOAuthService } from "./linkedin-oauth.service";
import { MetaOAuthService } from "./meta-oauth.service";
import { SocialAccountsController } from "./social-accounts.controller";
import { SocialAuthController } from "./social-auth.controller";
import { SocialAccountsService } from "./social-accounts.service";

@Module({
  imports: [AuthModule, OrganizationsModule, AuditModule, ConfigModule],
  controllers: [SocialAccountsController, SocialAuthController],
  providers: [SocialAccountsService, LinkedInOAuthService, MetaOAuthService],
  exports: [SocialAccountsService]
})
export class SocialAccountsModule {}
