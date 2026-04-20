"use client";

import {
  SocialAccountSummary,
  SocialConnectionCallbackStatus,
  SocialProviderAvailability
} from "@cast-loop/shared";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSessionContext } from "@/components/providers/session-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { BuildingIcon, LinkIcon } from "@/components/ui/icons";
import { ProviderPill } from "@/components/ui/provider-pill";
import { DataState } from "@/components/ui/data-state";
import { OrganizationScope } from "@/components/ui/organization-scope";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import {
  fetchSocialAccounts,
  fetchPendingSocialAccountSelection,
  fetchSocialProviderAvailability,
  startSocialConnection,
  completePendingSocialAccountSelection
} from "@/lib/api";

export default function SocialAccountsPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [providers, setProviders] = useState<SocialProviderAvailability[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [flashStatus, setFlashStatus] = useState<SocialConnectionCallbackStatus | null>(null);
  const [flashProvider, setFlashProvider] = useState<string | null>(null);
  const [flashVariant, setFlashVariant] = useState<string | null>(null);
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<Awaited<
    ReturnType<typeof fetchPendingSocialAccountSelection>
  > | null>(null);
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);

  const callbackStatus = searchParams.get("socialConnectionStatus") as SocialConnectionCallbackStatus | null;
  const callbackProvider = searchParams.get("provider");
  const callbackVariant = searchParams.get("variant");
  const callbackSelectionToken = searchParams.get("selectionToken");

  useEffect(() => {
    if (!callbackStatus) {
      return;
    }

    setFlashStatus(callbackStatus);
    setFlashProvider(callbackProvider);
    setFlashVariant(callbackVariant);
    setSelectionToken(callbackSelectionToken);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("socialConnectionStatus");
    nextParams.delete("provider");
    nextParams.delete("variant");
    nextParams.delete("selectionToken");
    const nextSearch = nextParams.toString();
    const nextUrl = nextSearch ? `/social-accounts?${nextSearch}` : "/social-accounts";

    window.history.replaceState({}, "", nextUrl);
  }, [callbackProvider, callbackSelectionToken, callbackStatus, callbackVariant, searchParams]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken || !activeOrganizationId) {
      setAccounts([]);
      setProviders([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchSocialAccounts(accessToken, activeOrganizationId),
      fetchSocialProviderAvailability(accessToken, activeOrganizationId)
    ])
      .then(([nextAccounts, nextProviders]) => {
        if (!active) return;
        setAccounts(nextAccounts);
        setProviders(nextProviders);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(
          nextError instanceof Error ? nextError.message : "Impossible de charger les comptes sociaux."
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, status]);

  useEffect(() => {
    if (!accessToken || !activeOrganizationId || !selectionToken || flashStatus !== "selection_required") {
      setPendingSelection(null);
      return;
    }

    let active = true;
    setIsLoadingSelection(true);

    void fetchPendingSocialAccountSelection(accessToken, activeOrganizationId, selectionToken)
      .then((result) => {
        if (!active) return;
        setPendingSelection(result);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger la selection de comptes.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingSelection(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, flashStatus, selectionToken]);

  const callbackMessage = useMemo(() => {
    if (!flashStatus) {
      return null;
    }

    const providerLabel = flashProvider === "linkedin" ? "LinkedIn" : "Le provider";

    switch (flashStatus) {
      case "success":
        return {
          tone: "success",
          text: `${providerLabel} est maintenant connecté.`
        };
      case "cancelled":
        return {
          tone: "warning",
          text: `La connexion ${providerLabel} a ete annulee.`
        };
      case "provider_not_configured":
        return {
          tone: "warning",
          text: `${providerLabel} n'est pas configure sur le serveur.`
        };
      case "invalid_state":
        return {
          tone: "danger",
          text: "Le retour OAuth est invalide ou a expire."
        };
      case "no_eligible_account":
        return {
          tone: "warning",
          text: "Aucun compte ou page eligible n'a ete trouve pour ce parcours."
        };
      case "selection_required":
        return {
          tone: "warning",
          text: `Plusieurs comptes sont disponibles pour ${flashVariantLabel(flashVariant)}. Selectionnez celui a connecter.`
        };
      case "oauth_error":
      case "unknown_error":
      default:
        return {
          tone: "danger",
          text: `La connexion ${providerLabel} a echoue.`
        };
    }
  }, [flashProvider, flashStatus, flashVariant]);

  useEffect(() => {
    if (!callbackMessage) return;
    if (callbackMessage.tone === "success") {
      toast.success(callbackMessage.text);
    } else if (callbackMessage.tone === "warning") {
      toast.warning(callbackMessage.text);
    } else {
      toast.error(callbackMessage.text);
    }
  }, [callbackMessage, toast]);

  const handleConnectionStart = async (
    provider: "facebook" | "instagram" | "linkedin",
    variant: SocialProviderAvailability["variant"]
  ) => {
    if (!accessToken || !activeOrganizationId) return;

    setConnectingProvider(variant);

    try {
      const result = await startSocialConnection(accessToken, activeOrganizationId, provider, { variant });
      window.location.assign(result.authorizationUrl);
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Impossible de démarrer la connexion.";
      setError(message);
      toast.error(message);
      setConnectingProvider(null);
    }
  };

  const handlePendingSelection = async (externalAccountId: string) => {
    if (!accessToken || !activeOrganizationId || !selectionToken) return;

    try {
      await completePendingSocialAccountSelection(accessToken, activeOrganizationId, selectionToken, externalAccountId);
      setPendingSelection(null);
      setFlashStatus("success");
      setSelectionToken(null);

      const [nextAccounts, nextProviders] = await Promise.all([
        fetchSocialAccounts(accessToken, activeOrganizationId),
        fetchSocialProviderAvailability(accessToken, activeOrganizationId)
      ]);
      setAccounts(nextAccounts);
      setProviders(nextProviders);
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Impossible de finaliser la connexion.";
      setError(message);
      toast.error(message);
    }
  };

  if (isLoading || status !== "authenticated") {
    return (
      <DataState
        eyebrow="Comptes sociaux"
        title="Chargement des connexions"
        description="Recuperation des comptes sociaux relies a l'organisation active."
        loading
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

  if (error && accounts.length === 0 && providers.length === 0) {
    return <DataState eyebrow="Comptes sociaux" title="Chargement impossible" description={error} />;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Comptes sociaux</span>
        <h2>Connexions actives</h2>
        <OrganizationScope />
      </header>

      {error ? <p className="social-feedback social-feedback-danger">{error}</p> : null}

      <section className="panel social-provider-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Providers</span>
            <h2>Connecter un reseau</h2>
          </div>
        </div>

        <div className="social-provider-grid">
          {providers.map((provider) => {
            return (
              <article key={provider.variant} className="social-provider-card">
                <div className="social-provider-copy">
                  <ProviderPill provider={provider.provider} />
                  <strong>{provider.label}</strong>
                  <p>
                    <strong>{provider.capability === "publishable" ? "Publie" : "Connexion seule"}</strong>
                  </p>
                  <p>{provider.reason ?? "Connexion disponible pour cette organisation."}</p>
                </div>

                <button
                  type="button"
                  className="secondary-button secondary-button-action social-provider-button"
                  disabled={!provider.enabled || connectingProvider === provider.variant}
                  onClick={() => handleConnectionStart(provider.provider, provider.variant)}
                >
                  {connectingProvider === provider.variant ? "Connexion..." : "Connecter"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {flashStatus === "selection_required" ? (
        <section className="panel social-provider-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Selection requise</span>
              <h2>Choisir le compte a connecter</h2>
            </div>
          </div>

          {isLoadingSelection ? (
            <p className="muted">
              <Spinner size="sm" label="Chargement de la sélection" /> Chargement des comptes disponibles…
            </p>
          ) : pendingSelection && pendingSelection.accounts.length > 0 ? (
            <div className="social-provider-grid">
              {pendingSelection.accounts.map((account) => (
                <article key={account.externalAccountId} className="social-provider-card">
                  <div className="social-provider-copy">
                    <strong>{account.displayName}</strong>
                    <p>{account.handle}</p>
                    <p>
                      {accountLabel(account.accountType)} · {account.publishCapability === "publishable" ? "Publie" : "Connexion seule"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button secondary-button-action social-provider-button"
                    onClick={() => handlePendingSelection(account.externalAccountId)}
                  >
                    Connecter ce compte
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<LinkIcon />}
              title="Aucun compte sélectionnable"
              description="Le provider n'a remonté aucun compte finalisable pour ce parcours."
            />
          )}
        </section>
      ) : null}

      <div className="table-list table-list--accounts panel">
        <header className="table-row table-header">
          <span className="eyebrow">Compte</span>
          <span className="eyebrow">Type / capacite</span>
          <span className="eyebrow">Statut</span>
          <span className="eyebrow">Expiration du token</span>
        </header>

        {accounts.length === 0 ? (
          <EmptyState
            icon={<BuildingIcon />}
            title="Aucun compte connecté"
            description="Connecte ton premier compte LinkedIn, Facebook ou Instagram depuis le bloc ci-dessus pour commencer à publier."
            actions={
              <button
                type="button"
                className="secondary-button secondary-button-action"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Connecter un réseau
              </button>
            }
          />
        ) : (
          accounts.map((account) => (
            <article key={account.id} className="table-row">
              <div>
                <ProviderPill provider={account.provider} />
                <strong>{account.displayName}</strong>
                <p>{account.handle}</p>
              </div>
              <div>
                <strong>{accountLabel(account.accountType)}</strong>
                <p>{account.publishCapability === "publishable" ? "Publie" : "Connexion seule"}</p>
              </div>
              <div>
                <span className={`status status-${account.status}`}>{account.status}</span>
              </div>
              <div>
                <span className={tokenExpiryClassName(account.tokenExpiresAt)}>
                  <span className="token-expiry-dot" />
                  {formatTokenExpiry(account.tokenExpiresAt)}
                </span>
              </div>
            </article>
          ))
        )}
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

const tokenExpiryClassName = (tokenExpiresAt: string | null) => {
  const baseClassName = "token-expiry";
  if (!tokenExpiresAt) {
    return `${baseClassName} token-expiry-none`;
  }

  const expiresAt = new Date(tokenExpiresAt);
  const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) {
    return `${baseClassName} token-expiry-danger`;
  }

  if (diffDays <= 14) {
    return `${baseClassName} token-expiry-warning`;
  }

  return baseClassName;
};

const accountLabel = (accountType: string) => {
  switch (accountType) {
    case "personal":
      return "Profil perso";
    case "page":
      return "Page";
    case "business":
      return "Business";
    case "creator":
      return "Creator";
    default:
      return accountType;
  }
};

const flashVariantLabel = (variant: string | null) => {
  switch (variant) {
    case "linkedin_personal":
      return "Profil LinkedIn";
    case "linkedin_page":
      return "Page LinkedIn";
    case "facebook_page":
      return "Page Facebook";
    case "instagram_professional":
      return "Compte Instagram pro";
    case "meta_personal":
      return "Profil Facebook";
    default:
      return "ce provider";
  }
};
