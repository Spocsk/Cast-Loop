export interface AppEnv {
  apiPort: number;
  appWebUrl: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  tokenEncryptionKey: string;
  socialPublishMode: "mock" | "live";
  linkedinMemberClientId: string;
  linkedinMemberClientSecret: string;
  linkedinMemberRedirectUri: string;
  linkedinOrgClientId: string;
  linkedinOrgClientSecret: string;
  linkedinOrgRedirectUri: string;
  linkedinApiVersion: string;
  metaAppId: string;
  metaAppSecret: string;
  metaRedirectUri: string;
  metaApiVersion: string;
  telegramBotToken: string;
  telegramChatId: string;
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
  appWebUrl: process.env.APP_WEB_URL ?? "http://localhost:3001",
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  supabaseUrl: getRequiredEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "cast-loop-media",
  tokenEncryptionKey: getRequiredEnv("TOKEN_ENCRYPTION_KEY"),
  socialPublishMode: process.env.SOCIAL_PUBLISH_MODE === "live" ? "live" : "mock",
  linkedinMemberClientId: process.env.LINKEDIN_MEMBER_CLIENT_ID ?? "",
  linkedinMemberClientSecret: process.env.LINKEDIN_MEMBER_CLIENT_SECRET ?? "",
  linkedinMemberRedirectUri: process.env.LINKEDIN_MEMBER_REDIRECT_URI ?? "",
  linkedinOrgClientId: process.env.LINKEDIN_ORG_CLIENT_ID ?? "",
  linkedinOrgClientSecret: process.env.LINKEDIN_ORG_CLIENT_SECRET ?? "",
  linkedinOrgRedirectUri: process.env.LINKEDIN_ORG_REDIRECT_URI ?? "",
  linkedinApiVersion: process.env.LINKEDIN_API_VERSION ?? "",
  metaAppId: process.env.META_APP_ID ?? "",
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaRedirectUri: process.env.META_REDIRECT_URI ?? "",
  metaApiVersion: process.env.META_API_VERSION ?? "v21.0",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? ""
});
