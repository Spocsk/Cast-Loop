"use client";

import { CreateOrganizationResult, OrganizationSummary } from "@cast-loop/shared";
import { useCallback, useEffect, useState } from "react";
import { CreateCompanyDialog } from "@/components/companies/create-company-dialog";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { OrganizationScope } from "@/components/ui/organization-scope";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { fetchOrganizations } from "@/lib/api";

export default function CompaniesPage() {
  const { accessToken, activeOrganizationId, refreshSession, setActiveOrganization, status } = useSessionContext();
  const toast = useToast();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [pendingOrganizationId, setPendingOrganizationId] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    if (!accessToken) {
      setOrganizations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextOrganizations = await fetchOrganizations(accessToken);
      setOrganizations(nextOrganizations);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Impossible de charger les organisations.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    void loadOrganizations();
  }, [loadOrganizations, status]);

  const handleActivate = async (organizationId: string, organizationName: string) => {
    if (organizationId === activeOrganizationId) {
      return;
    }

    setPendingOrganizationId(organizationId);

    try {
      await setActiveOrganization(organizationId);
      await loadOrganizations();
      toast.success(`${organizationName} est maintenant l'entreprise active.`);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "Impossible d'activer cette entreprise.");
    } finally {
      setPendingOrganizationId(null);
    }
  };

  const handleCreated = async (organization: CreateOrganizationResult) => {
    await refreshSession();
    await loadOrganizations();
    toast.success(`${organization.name} a été créée et activée.`);
  };

  if (isLoading || status !== "authenticated") {
    return (
      <DataState
        eyebrow="Entreprises"
        title="Chargement des organisations"
        description="Lecture des organisations accessibles pour l'utilisateur connecte."
        loading
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Entreprises" title="Chargement impossible" description={error} />;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Entreprises</span>
        <h2>Organisations</h2>
        <OrganizationScope />
      </header>

      <section className="panel companies-panel">
        <div className="section-heading companies-heading">
          <div>
            <span className="eyebrow">Répertoire</span>
            <h2>Entreprises accessibles</h2>
          </div>

          <button type="button" className="primary-button companies-create-button" onClick={() => setIsCreateDialogOpen(true)}>
            Créer une entreprise
          </button>
        </div>

        {organizations.length > 0 ? (
          <div className="table-list table-list--companies">
            <header className="table-row table-header">
              <span className="eyebrow">Entreprise</span>
              <span className="eyebrow">Slug</span>
              <span className="eyebrow">Rôle</span>
              <span className="eyebrow">Statut</span>
              <span className="eyebrow">Action</span>
            </header>

            {organizations.map((organization) => (
              <article className="table-row table-row-company" key={organization.id}>
                <div className="company-cell company-cell-primary">
                  <strong>{organization.name}</strong>
                  <p>
                    {organization.id === activeOrganizationId
                      ? "Contexte actuellement chargé dans l'application."
                      : "Disponible pour basculer le contexte actif."}
                  </p>
                </div>

                <div className="company-cell company-cell-slug">
                  <span className="company-card-label eyebrow">Slug</span>
                  <strong className="company-inline-value">{organization.slug}</strong>
                </div>

                <div className="company-cell company-cell-role">
                  <span className="company-card-label eyebrow">Rôle</span>
                  <span className="provider-pill company-role-pill">{organization.role}</span>
                </div>

                <div className="company-cell company-cell-status">
                  <span className="company-card-label eyebrow">Statut</span>
                  <span
                    className={`status ${
                      organization.id === activeOrganizationId ? "status-connected" : "status-expired"
                    }`}
                  >
                    {organization.id === activeOrganizationId ? "active" : "disponible"}
                  </span>
                </div>

                <div className="company-cell company-cell-action">
                  <span className="company-card-label eyebrow">Action</span>
                  <button
                    type="button"
                    className={
                      organization.id === activeOrganizationId
                        ? "secondary-button secondary-button-action company-action-button company-action-button-active"
                        : "secondary-button secondary-button-action company-action-button company-action-button-available"
                    }
                    disabled={organization.id === activeOrganizationId || pendingOrganizationId === organization.id}
                    onClick={() => void handleActivate(organization.id, organization.name)}
                    aria-label={
                      organization.id === activeOrganizationId
                        ? `${organization.name} est deja l'entreprise active`
                        : `Activer ${organization.name}`
                    }
                    title={
                      organization.id === activeOrganizationId
                        ? "Entreprise active"
                        : `Activer ${organization.name}`
                    }
                  >
                    {pendingOrganizationId === organization.id ? (
                      <Spinner size="sm" label="Activation en cours" />
                    ) : organization.id === activeOrganizationId ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9.2 12.8l1.9 1.9 3.7-4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="8.25"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M7 7h7a4 4 0 0 1 0 8h-1.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M13.5 17 11 15l2.5-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M17 17H10a4 4 0 0 1 0-8h1.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.5 7 13 9l-2.5 2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    <span className="sr-only">
                      {organization.id === activeOrganizationId
                        ? "Entreprise active"
                        : pendingOrganizationId === organization.id
                          ? "Activation en cours"
                          : "Activer"}
                    </span>
                    <span className="company-action-button-copy" aria-hidden="true">
                      {organization.id === activeOrganizationId
                        ? "Entreprise active"
                        : pendingOrganizationId === organization.id
                          ? "Activation…"
                          : "Activer l'entreprise"}
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="social-empty-state">
            <strong>Aucune entreprise pour l'instant</strong>
            <p>Crée une première entreprise pour commencer à gérer un contexte multi-organisation dans Cast Loop.</p>
          </div>
        )}
      </section>

      <CreateCompanyDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={(organization) => handleCreated(organization)}
      />
    </div>
  );
}
