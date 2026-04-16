import {
  CalendarPostItem,
  OrganizationSummary,
  PostState,
  PostSummary,
  SocialAccountSummary,
  MediaAssetSummary,
  AuthenticatedAppUser,
  OrganizationRole
} from "@cast-loop/shared";
import { webEnv } from "./env";

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

export async function fetchPosts(accessToken: string, organizationId: string, state?: PostState) {
  const searchParams = new URLSearchParams({ organizationId });

  if (state) {
    searchParams.set("state", state);
  }

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
