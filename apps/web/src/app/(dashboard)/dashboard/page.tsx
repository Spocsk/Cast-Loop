"use client";

import { SocialProvider } from "@cast-loop/shared";
import { useCallback, useEffect, useState } from "react";
import { CalendarBoard } from "@/components/posts/calendar-board";
import { PostsTable } from "@/components/posts/posts-table";
import { useSessionContext } from "@/components/providers/session-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { BuildingIcon } from "@/components/ui/icons";
import { ProviderPill } from "@/components/ui/provider-pill";
import { OrganizationScope } from "@/components/ui/organization-scope";
import { StatCard } from "@/components/ui/stat-card";
import { DataState } from "@/components/ui/data-state";
import { DashboardSnapshot, getDashboardSnapshot } from "@/lib/api";

export default function DashboardPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    if (!accessToken || !activeOrganizationId) return;
    try {
      const nextSnapshot = await getDashboardSnapshot(accessToken, activeOrganizationId);
      setSnapshot(nextSnapshot);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Impossible de charger le tableau de bord.");
    }
  }, [accessToken, activeOrganizationId]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken || !activeOrganizationId) {
      setSnapshot(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void getDashboardSnapshot(accessToken, activeOrganizationId)
      .then((nextSnapshot) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger le tableau de bord.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, status]);

  if (isLoading || status !== "authenticated") {
    return (
        <DataState
        eyebrow="Dashboard"
        title="Connexion à Supabase"
        description="Chargement des données réelles du cockpit de publication."
        loading
      />
    );
  }

  if (!activeOrganizationId) {
    return (
      <DataState
        eyebrow="Dashboard"
        title="Aucune organisation disponible"
        description="Le compte connecté n'a encore aucune organisation associée dans Supabase."
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Dashboard" title="Chargement impossible" description={error} />;
  }

  if (!snapshot) {
    return (
      <DataState
        eyebrow="Dashboard"
        title="Aucune donnée disponible"
        description="La session est active, mais aucun snapshot n'a pu être construit."
      />
    );
  }

  const connectedProviders = Array.from(
    new Set(
      snapshot.socialAccounts
        .filter((account) => account.status === "connected" && account.publishCapability === "publishable")
        .map((account) => account.provider)
    )
  ) as SocialProvider[];
  const postsDueSoon = snapshot.posts.filter((post) => {
    if (post.state !== "scheduled" || !post.scheduledAt) return false;
    const diffMs = new Date(post.scheduledAt).getTime() - Date.now();
    return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
  }).length;
  const accountsExpiringSoon = snapshot.socialAccounts.filter((account) => {
    if (account.status !== "connected" || !account.tokenExpiresAt) return false;
    const diffDays = Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays <= 14;
  }).length;
  const failedPosts = snapshot.kpis.failed;

  return (
    <div className="page-stack">
      <section className="panel page-header-with-pills">
        <header className="page-header">
          <span className="eyebrow">Vue d'ensemble</span>
          <h2>Tableau de bord</h2>
          <OrganizationScope />
        </header>
        <div className="provider-stack">
          {connectedProviders.length > 0 ? (
            connectedProviders.map((provider) => <ProviderPill key={provider} provider={provider} />)
          ) : (
            <EmptyState
              icon={<BuildingIcon />}
              title="Aucun compte social connecté"
              description="Connecte un premier réseau pour commencer à planifier et publier depuis le cockpit."
            />
          )}
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Programmes"
          value={snapshot.kpis.scheduled}
          hint={postsDueSoon > 0 ? `${postsDueSoon} publication(s) dans moins de 24h` : "En attente de publication"}
          className={postsDueSoon > 0 ? "stat-card-accent" : undefined}
        />
        <StatCard label="Brouillons" value={snapshot.kpis.drafts} hint="En cours d'édition" />
        <StatCard
          label="Echecs"
          value={failedPosts}
          hint={failedPosts > 0 ? "Des publications demandent une action" : "Aucun échec en attente"}
          className={failedPosts > 0 ? "stat-card-danger" : undefined}
        />
        <StatCard
          label="Comptes"
          value={snapshot.kpis.connectedAccounts}
          hint={
            accountsExpiringSoon > 0
              ? `${accountsExpiringSoon} compte(s) à reconnecter bientôt`
              : "Connectés et actifs"
          }
          className={accountsExpiringSoon > 0 ? "stat-card-warning" : undefined}
        />
      </section>

      <CalendarBoard items={snapshot.calendarItems} />
      <PostsTable items={snapshot.posts} onRefresh={loadSnapshot} />
    </div>
  );
}
