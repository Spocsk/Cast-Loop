"use client";

import { SocialAccountSummary } from "@cast-loop/shared";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { ProviderPill } from "@/components/ui/provider-pill";
import { DataState } from "@/components/ui/data-state";
import { fetchSocialAccounts } from "@/lib/api";

export default function SocialAccountsPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken || !activeOrganizationId) {
      setAccounts([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void fetchSocialAccounts(accessToken, activeOrganizationId)
      .then((nextAccounts) => {
        if (!active) return;
        setAccounts(nextAccounts);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger les comptes sociaux.");
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
        eyebrow="Comptes sociaux"
        title="Chargement des connexions"
        description="Recuperation des comptes sociaux relies a l'organisation active."
      />
    );
  }

  if (!activeOrganizationId) {
    return (
      <DataState
        eyebrow="Comptes sociaux"
        title="Aucune organisation active"
        description="Une organisation active est necessaire pour afficher les comptes sociaux."
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Comptes sociaux" title="Chargement impossible" description={error} />;
  }

  if (accounts.length === 0) {
    return (
      <DataState
        eyebrow="Comptes sociaux"
        title="Aucun compte connecte"
        description="Ajoute un compte Facebook, Instagram ou LinkedIn pour commencer a publier."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Comptes sociaux</span>
        <h2>Connexions actives</h2>
      </header>

      <div className="table-list table-list--accounts panel">
        <header className="table-row table-header">
          <span className="eyebrow">Compte</span>
          <span className="eyebrow">Statut</span>
          <span className="eyebrow">Expiration du token</span>
        </header>
        {accounts.map((account) => (
          <article key={account.id} className="table-row">
            <div>
              <ProviderPill provider={account.provider} />
              <strong>{account.displayName}</strong>
              <p>{account.handle}</p>
            </div>
            <div>
              <span className={`status status-${account.status}`}>{account.status}</span>
            </div>
            <div>
              <strong>{formatTokenExpiry(account.tokenExpiresAt)}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const formatTokenExpiry = (tokenExpiresAt: string | null) => {
  if (!tokenExpiresAt) {
    return "Aucun";
  }

  return new Date(tokenExpiresAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};
