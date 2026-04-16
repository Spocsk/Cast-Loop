"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseClientEnv, webEnv } from "../env";

let browserClient: SupabaseClient | null | undefined;

export const createSupabaseBrowserClient = () => {
  if (!hasSupabaseClientEnv) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(webEnv.supabaseUrl, webEnv.supabaseAnonKey);
  }

  return browserClient;
};
