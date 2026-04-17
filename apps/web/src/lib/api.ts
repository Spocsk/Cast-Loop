import {
  CalendarPostItem,
  CreateMediaUploadUrlInput,
  CreateMediaUploadUrlResult,
  CreatePostInput,
  CreatePostResult,
  MediaAssetViewUrlResult,
  OrganizationSummary,
  PostVisibility,
  PostState,
  PostSummary,
  SocialAccountSummary,
  MediaAssetSummary,
  AuthenticatedAppUser,
  OrganizationRole,
  UpdatePostInput,
  UpdatePostResult
} from "@cast-loop/shared";
import { webEnv } from "./env";
import { createSupabaseBrowserClient } from "./supabase/client";

interface Membership {
  organizationId: string;
  role: OrganizationRole;
}

interface ValidatedSession {
  user: AuthenticatedAppUser;
  memberships: Membership[];
  activeOrganizationId: string | null;
}

export interface DashboardSnapshot {
  organizations: OrganizationSummary[];
  socialAccounts: SocialAccountSummary[];
  posts: PostSummary[];
  calendarItems: CalendarPostItem[];
  kpis: {
    scheduled: number;
    drafts: number;
    failed: number;
    connectedAccounts: number;
  };
}

const buildApiUrl = (path: string, searchParams?: URLSearchParams) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${webEnv.apiUrl}${normalizedPath}`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
};

async function apiRequest<T>(path: string, accessToken: string, init?: RequestInit, searchParams?: URLSearchParams): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path, searchParams), {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `Requete API en echec (${response.status})`;
    const responseText = await response.text();

    try {
      const payload = JSON.parse(responseText) as { message?: string | string[] };

      if (Array.isArray(payload.message)) {
        message = payload.message.join(", ");
      } else if (payload.message) {
        message = payload.message;
      }
    } catch {
      if (responseText) {
        message = responseText;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function validateAppSession(accessToken: string, organizationId?: string) {
  return apiRequest<ValidatedSession>(
    "/auth/session/validate",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(organizationId ? { organizationId } : {})
    }
  );
}

export async function fetchOrganizations(accessToken: string) {
  return apiRequest<OrganizationSummary[]>("/organizations", accessToken);
}

export async function fetchPosts(
  accessToken: string,
  organizationId: string,
  state?: PostState,
  visibility: PostVisibility = "active"
) {
  const searchParams = new URLSearchParams({ organizationId });

  if (state) {
    searchParams.set("state", state);
  }

  searchParams.set("visibility", visibility);

  return apiRequest<PostSummary[]>("/posts", accessToken, undefined, searchParams);
}

export async function fetchCalendar(accessToken: string, organizationId: string, from: string, to: string) {
  const searchParams = new URLSearchParams({
    organizationId,
    from,
    to
  });

  return apiRequest<CalendarPostItem[]>("/calendar", accessToken, undefined, searchParams);
}

export async function fetchSocialAccounts(accessToken: string, organizationId: string) {
  return apiRequest<SocialAccountSummary[]>(`/organizations/${organizationId}/social-accounts`, accessToken);
}

export async function fetchMediaAssets(accessToken: string, organizationId: string) {
  const searchParams = new URLSearchParams({ organizationId });
  return apiRequest<MediaAssetSummary[]>("/media", accessToken, undefined, searchParams);
}

export async function fetchMediaAssetViewUrl(accessToken: string, organizationId: string, assetId: string) {
  const searchParams = new URLSearchParams({ organizationId });
  return apiRequest<MediaAssetViewUrlResult>(`/media/${assetId}/view-url`, accessToken, undefined, searchParams);
}

export async function createPost(accessToken: string, payload: CreatePostInput) {
  return apiRequest<CreatePostResult>("/posts", accessToken, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updatePost(accessToken: string, postId: string, payload: UpdatePostInput) {
  return apiRequest<UpdatePostResult>(`/posts/${postId}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function archivePost(accessToken: string, postId: string, organizationId: string) {
  return apiRequest<{ id: string; archivedAt: string }>(`/posts/${postId}/archive`, accessToken, {
    method: "POST",
    body: JSON.stringify({ organizationId })
  });
}

export async function restorePost(accessToken: string, postId: string, organizationId: string) {
  return apiRequest<{ id: string; archivedAt: string | null }>(`/posts/${postId}/restore`, accessToken, {
    method: "POST",
    body: JSON.stringify({ organizationId })
  });
}

export async function deletePost(accessToken: string, postId: string, organizationId: string) {
  return apiRequest<{ id: string; deleted: true }>(`/posts/${postId}`, accessToken, {
    method: "DELETE",
    body: JSON.stringify({ organizationId })
  });
}

export async function createMediaUploadUrl(accessToken: string, payload: CreateMediaUploadUrlInput) {
  return apiRequest<CreateMediaUploadUrlResult>("/media/upload-url", accessToken, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function uploadImageToSignedUrl(params: {
  bucket: string;
  path: string;
  token: string;
  file: File;
}) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase n'est pas configure pour l'upload.");
  }

  const { error } = await supabase.storage
    .from(params.bucket)
    .uploadToSignedUrl(params.path, params.token, params.file, {
      contentType: params.file.type
    });

  if (error) {
    throw new Error(error.message ?? "Echec de l'upload du fichier.");
  }
}

export async function getDashboardSnapshot(accessToken: string, organizationId: string) {
  const dateRange = getDashboardDateRange();

  const [organizations, socialAccounts, posts, calendarItems] = await Promise.all([
    fetchOrganizations(accessToken),
    fetchSocialAccounts(accessToken, organizationId),
    fetchPosts(accessToken, organizationId),
    fetchCalendar(accessToken, organizationId, dateRange.from, dateRange.to)
  ]);

  return {
    organizations,
    socialAccounts,
    posts,
    calendarItems,
    kpis: {
      scheduled: posts.filter((post) => post.state === "scheduled").length,
      drafts: posts.filter((post) => post.state === "draft").length,
      failed: posts.filter((post) => post.state === "failed").length,
      connectedAccounts: socialAccounts.filter((account) => account.status === "connected").length
    }
  } satisfies DashboardSnapshot;
}

const getDashboardDateRange = () => {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  from.setDate(from.getDate() - 30);
  to.setMonth(to.getMonth() + 6);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
};
