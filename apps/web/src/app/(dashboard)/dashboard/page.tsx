"use client";

import { SocialProvider } from "@cast-loop/shared";
import { useCallback, useEffect, useState } from "react";
import { CalendarBoard } from "@/components/posts/calendar-board";
import { PostsTable } from "@/components/posts/posts-table";
import { useSessionContext } from "@/components/providers/session-provider";
import { ProviderPill } from "@/components/ui/provider-pill";
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
        title="Connexion a Supabase"
        description="Chargement des donnees reelles du cockpit de publication."
      />
    );
  }

  if (!activeOrganizationId) {
    return (
      <DataState
        eyebrow="Dashboard"
        title="Aucune organisation disponible"
        description="Le compte connecte n'a encore aucune organisation associee dans Supabase."
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
        title="Aucune donnee disponible"
        description="La session est active, mais aucun snapshot n'a pu etre construit."
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

  return (
    <div className="page-stack">
      <section className="hero panel">
        <div>
          <span className="eyebrow">Vue d'ensemble</span>
          <h2>Tableau de bord</h2>
        </div>
        <div className="provider-stack">
          {connectedProviders.length > 0 ? (
            connectedProviders.map((provider) => <ProviderPill key={provider} provider={provider} />)
          ) : (
            <p className="muted">Aucun compte social connecte.</p>
          )}
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Programmes" value={snapshot.kpis.scheduled} hint="En attente de publication" />
        <StatCard label="Brouillons" value={snapshot.kpis.drafts} hint="En cours d'edition" />
        <StatCard label="Echecs" value={snapshot.kpis.failed} hint="A corriger" />
        <StatCard label="Comptes" value={snapshot.kpis.connectedAccounts} hint="Connectes et actifs" />
      </section>

      <CalendarBoard items={snapshot.calendarItems} />
      <PostsTable items={snapshot.posts} onRefresh={loadSnapshot} />
    </div>
  );
}
