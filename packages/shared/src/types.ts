export const socialProviders = ["facebook", "instagram", "linkedin"] as const;
export type SocialProvider = (typeof socialProviders)[number];

export const organizationRoles = ["owner", "manager", "editor"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const socialAccountStatuses = ["connected", "expired", "disconnected"] as const;
export type SocialAccountStatus = (typeof socialAccountStatuses)[number];

export const postStates = ["draft", "scheduled", "publishing", "published", "failed", "cancelled"] as const;
export type PostState = (typeof postStates)[number];

export const postVisibilities = ["active", "archived"] as const;
export type PostVisibility = (typeof postVisibilities)[number];

export const postTargetStatuses = ["pending", "published", "failed", "cancelled"] as const;
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

export interface SocialAccountSummary {
  id: string;
  organizationId: string;
  provider: SocialProvider;
  displayName: string;
  handle: string;
  status: SocialAccountStatus;
  tokenExpiresAt: string | null;
}

export interface MediaAssetSummary {
  id: string;
  organizationId: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
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
}

export interface CreatePostResult {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  scheduledAt: string | null;
  state: PostState;
}

export interface UpdatePostInput {
  organizationId: string;
  title: string;
  content: string;
  primaryMediaAssetId?: string;
  targetSocialAccountIds?: string[];
  scheduledAt?: string;
}

export interface UpdatePostResult {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  scheduledAt: string | null;
  state: PostState;
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
