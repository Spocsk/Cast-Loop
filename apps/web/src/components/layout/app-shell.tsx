"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { getGravatarUrl } from "@/lib/gravatar";

const navigation: Array<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Overview" },
  { href: "/calendar", label: "Calendrier" },
  { href: "/posts", label: "Posts" },
  { href: "/media", label: "Médias" },
  { href: "/companies", label: "Entreprises" },
  { href: "/social-accounts", label: "Comptes sociaux" },
  { href: "/settings", label: "Paramètres" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useSessionContext();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const userDisplayName = useMemo(() => {
    if (!user) return null;
    if (user.fullName?.trim()) return user.fullName;
    return user.email.split("@")[0];
  }, [user]);

  const gravatarUrl = useMemo(() => {
    if (!user?.email) return null;
    return getGravatarUrl(user.email, 96);
  }, [user]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    setIsMobileNavOpen(false);
    router.push("/auth/login");
  };

  return (
    <div className={`app-shell ${isMobileNavOpen ? "nav-open" : ""}`}>
      <aside className={`sidebar ${isMobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-mobile-bar">
          <div className="sidebar-brand">
            <Image
              src="/assets/cast-loop-logo-white.png"
              alt="Logo Cast Loop"
              width={768}
              height={768}
              className="brand-mark"
              priority
            />
            <div className="sidebar-brand-copy">
              <p className="brand-kicker">Cast Loop</p>
              <h1>Cockpit de publication</h1>
            </div>
          </div>

          <div className="sidebar-mobile-actions">
            {user && userDisplayName && gravatarUrl ? (
              <div className="sidebar-user-chip" aria-label={`Connecte en tant que ${userDisplayName}`}>
                <img src={gravatarUrl} alt="" className="sidebar-user-avatar" />
                <span>{userDisplayName}</span>
              </div>
            ) : null}

            <button
              type="button"
              className="sidebar-toggle"
              aria-expanded={isMobileNavOpen}
              aria-controls="sidebar-navigation"
              aria-label={isMobileNavOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setIsMobileNavOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        <div className="sidebar-panel">
          <nav id="sidebar-navigation" className="sidebar-nav">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? "active" : ""}
                onClick={() => setIsMobileNavOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {user && userDisplayName && gravatarUrl ? (
            <div className="sidebar-user-card">
              <img src={gravatarUrl} alt="" className="sidebar-user-avatar" />
              <div className="sidebar-user-meta">
                <span className="eyebrow">Connecte</span>
                <strong>{userDisplayName}</strong>
                <p>{user.email}</p>
              </div>
              <button
                type="button"
                className="sidebar-signout-button"
                aria-label="Se déconnecter"
                title="Se déconnecter"
                onClick={handleSignOut}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M14 7.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <button
        type="button"
        className="sidebar-backdrop"
        aria-hidden={!isMobileNavOpen}
        tabIndex={isMobileNavOpen ? 0 : -1}
        onClick={() => setIsMobileNavOpen(false)}
      />

      <main className="main-content">{children}</main>
    </div>
  );
}
