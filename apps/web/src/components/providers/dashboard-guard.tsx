"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "./session-provider";

export function DashboardGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useSessionContext();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return (
      <div className="page-stack">
        <section className="panel">
          <span className="eyebrow">Session</span>
          <h2>Connexion en cours</h2>
          <p>Vérification de la session Supabase et chargement de l'espace de travail.</p>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}
