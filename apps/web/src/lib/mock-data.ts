import { CalendarPostItem, OrganizationSummary, PostSummary, SocialAccountSummary } from "@cast-loop/shared";

export const organizations: OrganizationSummary[] = [
  { id: "org-personal", name: "Studio Dylan", slug: "studio-dylan", role: "owner" },
  { id: "org-client", name: "Atelier Horizon", slug: "atelier-horizon", role: "manager" }
];

export const socialAccounts: SocialAccountSummary[] = [
  {
    id: "sa-1",
    organizationId: "org-personal",
    provider: "linkedin",
    displayName: "Studio Dylan LinkedIn",
    handle: "@studio-dylan",
    status: "connected",
    tokenExpiresAt: "2026-07-10T10:00:00.000Z"
  },
  {
    id: "sa-2",
    organizationId: "org-personal",
    provider: "instagram",
    displayName: "Studio Dylan Insta",
    handle: "@cast.loop",
    status: "connected",
    tokenExpiresAt: "2026-05-01T10:00:00.000Z"
  },
  {
    id: "sa-3",
    organizationId: "org-client",
    provider: "facebook",
    displayName: "Atelier Horizon Page",
    handle: "@atelierhorizon",
    status: "expired",
    tokenExpiresAt: "2026-04-12T08:00:00.000Z"
  }
];

export const posts: PostSummary[] = [
  {
    id: "post-1",
    organizationId: "org-personal",
    title: "Lancement du nouveau calendrier",
    content: "Annonce de la nouvelle timeline editoriale.",
    scheduledAt: "2026-04-12T09:00:00.000Z",
    state: "scheduled",
    primaryMediaAssetId: "asset-1",
    targetCount: 2
  },
  {
    id: "post-2",
    organizationId: "org-personal",
    title: "Case study Notion creator",
    content: "Retour terrain sur un mois de production.",
    scheduledAt: null,
    state: "draft",
    primaryMediaAssetId: null,
    targetCount: 1
  },
  {
    id: "post-3",
    organizationId: "org-client",
    title: "Promo capsule ete",
    content: "Teasing de collection pour Atelier Horizon.",
    scheduledAt: "2026-04-15T13:30:00.000Z",
    state: "failed",
    primaryMediaAssetId: "asset-9",
    targetCount: 1
  }
];

export const calendarItems: CalendarPostItem[] = [
  {
    id: "cal-1",
    title: "Lancement du nouveau calendrier",
    scheduledAt: "2026-04-12T09:00:00.000Z",
    state: "scheduled",
    providers: ["linkedin", "instagram"]
  },
  {
    id: "cal-2",
    title: "Promo capsule ete",
    scheduledAt: "2026-04-15T13:30:00.000Z",
    state: "failed",
    providers: ["facebook"]
  }
];

export const mediaLibrary = [
  {
    id: "asset-1",
    label: "Key visual editoriale",
    dimensions: "1080 x 1350",
    type: "image/png",
    size: "2.4 MB"
  },
  {
    id: "asset-9",
    label: "Visuel collection printemps",
    dimensions: "1080 x 1080",
    type: "image/jpeg",
    size: "1.1 MB"
  }
];
