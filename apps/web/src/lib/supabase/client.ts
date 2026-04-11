"use client";

import { createClient } from "@supabase/supabase-js";
import { hasSupabaseClientEnv, webEnv } from "../env";

export const createSupabaseBrowserClient = () => {
  if (!hasSupabaseClientEnv) {
    return null;
  }

  return createClient(webEnv.supabaseUrl, webEnv.supabaseAnonKey);
};
