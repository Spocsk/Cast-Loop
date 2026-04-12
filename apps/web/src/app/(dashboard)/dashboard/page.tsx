import { CalendarBoard } from "@/components/posts/calendar-board";
import { PostsTable } from "@/components/posts/posts-table";
import { StatCard } from "@/components/ui/stat-card";
import { ProviderPill } from "@/components/ui/provider-pill";
import { getDashboardSnapshot } from "@/lib/api";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="page-stack">
      <section className="hero panel">
        <div>
          <span className="eyebrow">Vue d'ensemble</span>
          <h2>Tableau de bord</h2>
        </div>
        <div className="provider-stack">
          <ProviderPill provider="facebook" />
          <ProviderPill provider="instagram" />
          <ProviderPill provider="linkedin" />
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Programmes" value={snapshot.kpis.scheduled} hint="En attente de publication" />
        <StatCard label="Brouillons" value={snapshot.kpis.drafts} hint="En cours d'edition" />
        <StatCard label="Echecs" value={snapshot.kpis.failed} hint="A corriger" />
        <StatCard label="Comptes" value={snapshot.kpis.connectedAccounts} hint="Connectes et actifs" />
      </section>

      <CalendarBoard items={snapshot.calendarItems} />
      <PostsTable items={snapshot.posts} />
    </div>
  );
}
