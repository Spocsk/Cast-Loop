export const socialProviders = ["facebook", "instagram", "linkedin"] as const;
export type SocialProvider = (typeof socialProviders)[number];

export const socialAccountTypes = ["personal", "page", "business", "creator"] as const;
export type SocialAccountType = (typeof socialAccountTypes)[number];

export const socialAccountCapabilities = ["publishable", "connect_only"] as const;
export type SocialAccountCapability = (typeof socialAccountCapabilities)[number];

export const socialProviderConnectionVariants = [
  "linkedin_personal",
  "linkedin_page",
  "facebook_page",
  "instagram_professional",
  "meta_personal"
] as const;
export type SocialProviderConnectionVariant = (typeof socialProviderConnectionVariants)[number];

export const organizationRoles = ["owner", "manager", "editor"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const socialAccountStatuses = ["connected", "expired", "disconnected"] as const;
export type SocialAccountStatus = (typeof socialAccountStatuses)[number];

export const socialConnectionCallbackStatuses = [
  "success",
  "cancelled",
  "provider_not_configured",
  "invalid_state",
  "oauth_error",
  "no_eligible_account",
  "selection_required",
  "unknown_error"
] as const;
export type SocialConnectionCallbackStatus = (typeof socialConnectionCallbackStatuses)[number];

export const postStates = ["draft", "scheduled", "publishing", "published", "failed", "cancelled"] as const;
export type PostState = (typeof postStates)[number];

export const postVisibilities = ["active", "archived"] as const;
export type PostVisibility = (typeof postVisibilities)[number];

export const postTargetStatuses = ["pending", "published", "notified", "failed", "cancelled"] as const;
export type PostTargetStatus = (typeof postTargetStatuses)[number];

export interface AuthenticatedAppUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

export interface CreateOrganizationInput {
  name: string;
}

export interface CreateOrganizationResult extends OrganizationSummary {}

export interface SessionMembership {
  organizationId: string;
  role: OrganizationRole;
}

export interface ValidatedSessionResult {
  user: AuthenticatedAppUser;
  memberships: SessionMembership[];
  activeOrganizationId: string | null;
}

export interface SetActiveOrganizationInput {
  organizationId: string;
}

export interface SetActiveOrganizationResult extends ValidatedSessionResult {}

export interface SendTelegramTestMessageInput {
  organizationId: string;
}

export interface SendTelegramTestMessageResult {
  delivered: true;
  channel: "telegram";
  sentAt: string;
}

export interface ApiVersionResult {
  apiVersion: string;
}

export interface SocialAccountSummary {
  id: string;
  organizationId: string;
  provider: SocialProvider;
  displayName: string;
  handle: string;
  accountType: SocialAccountType;
  publishCapability: SocialAccountCapability;
  status: SocialAccountStatus;
  tokenExpiresAt: string | null;
}

export interface SocialProviderAvailability {
  provider: SocialProvider;
  variant: SocialProviderConnectionVariant;
  label: string;
  enabled: boolean;
  capability: SocialAccountCapability;
  reason: string | null;
}

export interface StartSocialConnectionInput {
  variant: SocialProviderConnectionVariant;
}

export interface StartSocialConnectionResult {
  provider: SocialProvider;
  variant: SocialProviderConnectionVariant;
  authorizationUrl: string;
}

export interface MediaAssetSummary {
  id: string;
  organizationId: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  usageCount: number;
}

export interface DeleteMediaAssetResult {
  id: string;
  deleted: true;
  usageCount: number;
}

export interface PostSummary {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  scheduledAt: string | null;
  archivedAt: string | null;
  state: PostState;
  primaryMediaAssetId: string | null;
  sendTelegramReminder: boolean;
  targetCount: number;
  targetSocialAccountIds: string[];
}

export interface CreatePostInput {
  organizationId: string;
  title: string;
  content: string;
  primaryMediaAssetId?: string;
  targetSocialAccountIds?: string[];
  scheduledAt?: string;
  sendTelegramReminder?: boolean;
}

export interface CreatePostResult {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  scheduledAt: string | null;
  state: PostState;
  sendTelegramReminder: boolean;
}

export interface ImportPostItemInput {
  title: string;
  content: string;
  primaryMediaAssetId?: string;
  targetSocialAccountIds?: string[];
  scheduledAt?: string;
  sendTelegramReminder?: boolean;
}

export interface ImportPostsInput {
  organizationId: string;
  posts: ImportPostItemInput[];
}

export interface ImportPostError {
  row: number;
  field: keyof ImportPostItemInput | "posts";
  message: string;
}

export interface ImportPostsResult {
  createdCount: number;
  posts: CreatePostResult[];
}

export interface UpdatePostInput {
  organizationId: string;
  title: string;
  content: string;
  primaryMediaAssetId?: string;
  targetSocialAccountIds?: string[];
  scheduledAt?: string;
  sendTelegramReminder?: boolean;
}

export interface UpdatePostResult {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  scheduledAt: string | null;
  state: PostState;
  sendTelegramReminder: boolean;
}

export interface CreateMediaUploadUrlInput {
  organizationId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
}

export interface CreateMediaUploadUrlResult {
  assetId: string;
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

export interface MediaAssetViewUrlResult {
  assetId: string;
  signedUrl: string;
  expiresInSeconds: number;
}

export interface CalendarPostItem {
  id: string;
  title: string;
  scheduledAt: string;
  state: PostState;
  providers: SocialProvider[];
}
