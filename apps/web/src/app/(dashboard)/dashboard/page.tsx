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
          <h2>Une cabine unique pour tes marques et celles de tes clients.</h2>
          <p>
            Le dashboard suit les drafts, les posts programmes, l'etat des comptes sociaux et les echecs de publication
            sans melanger les tenants.
          </p>
        </div>
        <div className="provider-stack">
          <ProviderPill provider="facebook" />
          <ProviderPill provider="instagram" />
          <ProviderPill provider="linkedin" />
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Posts programmes" value={snapshot.kpis.scheduled} hint="Files d'attente prêtes pour le scheduler." />
        <StatCard label="Brouillons" value={snapshot.kpis.drafts} hint="Contenus encore en cours d'edition." />
        <StatCard label="Echecs" value={snapshot.kpis.failed} hint="A retravailler ou reconnecter." />
        <StatCard label="Comptes connectes" value={snapshot.kpis.connectedAccounts} hint="Pages et comptes business actifs." />
      </section>

      <CalendarBoard items={snapshot.calendarItems} />
      <PostsTable items={snapshot.posts} />
    </div>
  );
}
