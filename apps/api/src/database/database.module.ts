import { Global, Module } from "@nestjs/common";
import { TokenCipherService } from "../common/crypto/token-cipher.service";
import { DatabaseService } from "./database.service";
import { SupabaseAdminService } from "./supabase-admin.service";

@Global()
@Module({
  providers: [DatabaseService, SupabaseAdminService, TokenCipherService],
  exports: [DatabaseService, SupabaseAdminService, TokenCipherService]
})
export class DatabaseModule {}
