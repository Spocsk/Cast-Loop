import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppEnv } from "../config/env";

@Injectable()
export class SupabaseAdminService {
  readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    this.client = createClient(
      this.configService.get("supabaseUrl", { infer: true }),
      this.configService.get("supabaseServiceRoleKey", { infer: true }),
      {
        auth: {
          persistSession: false
        }
      }
    );
  }
}
