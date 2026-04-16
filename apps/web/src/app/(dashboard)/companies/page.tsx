"use client";

import { OrganizationSummary } from "@cast-loop/shared";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { fetchOrganizations } from "@/lib/api";

export default function CompaniesPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken) {
      setOrganizations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void fetchOrganizations(accessToken)
      .then((nextOrganizations) => {
        if (!active) return;
        setOrganizations(nextOrganizations);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger les organisations.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, status]);

  if (isLoading || status !== "authenticated") {
    return (
      <DataState
        eyebrow="Entreprises"
        title="Chargement des organisations"
        description="Lecture des organisations accessibles pour l'utilisateur connecte."
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Entreprises" title="Chargement impossible" description={error} />;
  }

  if (organizations.length === 0) {
    return (
      <DataState
        eyebrow="Entreprises"
        title="Aucune organisation"
        description="Aucune organisation n'est encore rattachee a ce compte dans Supabase."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Entreprises</span>
        <h2>Organisations</h2>
      </header>

      <div className="grid-tiles">
        {organizations.map((organization) => (
          <article className="panel" key={organization.id}>
            <span className="eyebrow">
              {organization.id === activeOrganizationId ? "organisation active" : organization.role}
            </span>
            <strong>{organization.name}</strong>
            <p>{organization.slug}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
