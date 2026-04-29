"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { Dropdown } from "@/components/ui/dropdown";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { getGravatarUrl } from "@/lib/gravatar";

const navigation: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/calendar", label: "Calendrier" },
  { href: "/posts", label: "Posts" },
  { href: "/media", label: "Médias" },
  { href: "/companies", label: "Entreprises" },
  { href: "/social-accounts", label: "Comptes sociaux" },
  { href: "/settings", label: "Paramètres" }
];

const adminNavigation: Array<{ href: string; label: string }> = [{ href: "/admin", label: "Admin" }];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, organizations, activeOrganizationId, setActiveOrganization, signOut } =
    useSessionContext();
  const toast = useToast();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
  const mobileBarRef = useRef<HTMLDivElement | null>(null);
  const [mobilePanelTop, setMobilePanelTop] = useState(88);

  const userDisplayName = useMemo(() => {
    if (!user) return null;
    if (user.fullName?.trim()) return user.fullName;
    return user.email.split("@")[0];
  }, [user]);

  const gravatarUrl = useMemo(() => {
    if (!user?.email) return null;
    return getGravatarUrl(user.email, 96);
  }, [user]);

  const visibleNavigation = useMemo(
    () => (user?.platformRole === "super_admin" ? [...navigation, ...adminNavigation] : navigation),
    [user?.platformRole]
  );

  const currentNavLabel = useMemo(() => {
    return visibleNavigation.find((item) => item.href === pathname)?.label ?? null;
  }, [pathname, visibleNavigation]);

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        value: organization.id,
        label: organization.name,
        hint: organization.role
      })),
    [organizations]
  );

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const updateMobilePanelTop = () => {
      const nextTop = mobileBarRef.current?.getBoundingClientRect().bottom;

      if (!nextTop) {
        return;
      }

      setMobilePanelTop(Math.round(nextTop + 12));
    };

    updateMobilePanelTop();
    window.addEventListener("resize", updateMobilePanelTop);
    window.addEventListener("scroll", updateMobilePanelTop, { passive: true });
    window.visualViewport?.addEventListener("resize", updateMobilePanelTop);

    return () => {
      window.removeEventListener("resize", updateMobilePanelTop);
      window.removeEventListener("scroll", updateMobilePanelTop);
      window.visualViewport?.removeEventListener("resize", updateMobilePanelTop);
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsMobileNavOpen(false);
    router.push("/auth/login");
  };

  const handleOrganizationChange = async (organizationId: string) => {
    if (!organizationId || organizationId === activeOrganizationId) {
      return;
    }

    setIsSwitchingOrganization(true);

    try {
      await setActiveOrganization(organizationId);
      const organizationName =
        organizations.find((organization) => organization.id === organizationId)?.name ?? "Organisation";
      toast.success(`${organizationName} est maintenant l'entreprise active.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de changer d'entreprise active.");
    } finally {
      setIsSwitchingOrganization(false);
    }
  };

  return (
    <div
      className={`app-shell ${isMobileNavOpen ? "nav-open" : ""}`}
      style={{ ["--mobile-sidebar-panel-top" as string]: `${mobilePanelTop}px` }}
    >
      <aside className={`sidebar ${isMobileNavOpen ? "sidebar-open" : ""}`}>
        <div ref={mobileBarRef} className="sidebar-mobile-bar">
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
              {currentNavLabel ? (
                <span className="sidebar-current-crumb" aria-hidden="true">
                  {currentNavLabel}
                </span>
              ) : null}
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
          {organizations.length > 0 ? (
            <div className="sidebar-org-switcher">
              <Dropdown
                options={organizationOptions}
                value={activeOrganizationId}
                onChange={(nextValue) => void handleOrganizationChange(nextValue)}
                label="Changer d'entreprise active"
                kicker="Entreprise active"
                invert
                disabled={organizations.length <= 1 || isSwitchingOrganization}
                trailing={
                  isSwitchingOrganization ? (
                    <Spinner size="sm" label="Changement d'entreprise" />
                  ) : undefined
                }
              />
            </div>
          ) : null}

          <nav id="sidebar-navigation" className="sidebar-nav">
            {visibleNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
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
