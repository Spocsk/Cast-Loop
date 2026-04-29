import { Module } from "@nestjs/common";
import { PlatformAdminGuard } from "../../common/guards/platform-admin.guard";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseAuthGuard, PlatformAdminGuard],
  exports: [AuthService, SupabaseAuthGuard, PlatformAdminGuard]
})
export class AuthModule {}
