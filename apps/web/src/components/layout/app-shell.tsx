import Link from "next/link";
import type { Route } from "next";
import { ReactNode } from "react";

const navigation: Array<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Overview" },
  { href: "/calendar", label: "Calendrier" },
  { href: "/posts", label: "Posts" },
  { href: "/media", label: "Medias" },
  { href: "/companies", label: "Entreprises" },
  { href: "/social-accounts", label: "Comptes sociaux" },
  { href: "/settings", label: "Parametres" }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="brand-kicker">Cast Loop</p>
          <h1>Social publishing cockpit</h1>
          <p className="muted">Multi-tenant, centre agence, cadence editoriale unique.</p>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">Execution mode</span>
          <strong>Scheduler backend active</strong>
          <p>Les posts dus sont traites par Nest toutes les minutes.</p>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
