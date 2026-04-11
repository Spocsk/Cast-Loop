import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { SocialAccountsController } from "./social-accounts.controller";
import { SocialAccountsService } from "./social-accounts.service";

@Module({
  imports: [AuthModule, OrganizationsModule, AuditModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
  exports: [SocialAccountsService]
})
export class SocialAccountsModule {}
