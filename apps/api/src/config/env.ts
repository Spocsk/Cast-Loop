export interface AppEnv {
  apiPort: number;
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  tokenEncryptionKey: string;
  socialPublishMode: "mock" | "live";
}

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const getAppEnv = (): AppEnv => ({
  apiPort: Number(process.env.API_PORT ?? 4000),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  supabaseUrl: getRequiredEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "cast-loop-media",
  tokenEncryptionKey: getRequiredEnv("TOKEN_ENCRYPTION_KEY"),
  socialPublishMode: process.env.SOCIAL_PUBLISH_MODE === "live" ? "live" : "mock"
});
