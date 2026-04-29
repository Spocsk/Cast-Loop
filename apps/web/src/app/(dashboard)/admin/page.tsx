"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminOrganizationSummary,
  AdminUserSummary,
  organizationRoles,
  rolePermissions
} from "@cast-loop/shared";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import {
  createAdminOrganization,
  createAdminUser,
  deleteAdminOrganization,
  deleteAdminUser,
  fetchAdminOrganizations,
  fetchAdminUsers,
  resetAdminOrganizationSocialConnections,
  resetAdminUserPassword,
  updateAdminOrganization,
  updateAdminUser
} from "@/lib/api";

type AdminTab = "users" | "organizations" | "roles";

export default function AdminPage() {
  const { accessToken, status, user } = useSessionContext();
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordLink, setPasswordLink] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ email: "", fullName: "", organizationId: "", role: "editor" });
  const [newOrganizationName, setNewOrganizationName] = useState("");

  const canUseAdmin = user?.platformRole === "super_admin";

  const loadAdmin = useCallback(async () => {
    if (!accessToken || !canUseAdmin) {
      setUsers([]);
      setOrganizations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextUsers, nextOrganizations] = await Promise.all([
        fetchAdminUsers(accessToken),
        fetchAdminOrganizations(accessToken)
      ]);
      setUsers(nextUsers);
      setOrganizations(nextOrganizations);
      setNewUser((current) => ({
        ...current,
        organizationId: current.organizationId || nextOrganizations[0]?.id || ""
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Impossible de charger l'administration.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, canUseAdmin]);

  useEffect(() => {
    if (status === "authenticated") {
      void loadAdmin();
    }
  }, [loadAdmin, status]);

  const organizationOptions = useMemo(
    () => organizations.filter((organization) => organization.status === "active"),
    [organizations]
  );

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSaving(true);
    setPasswordLink(null);

    try {
      const result = await createAdminUser(accessToken, {
        email: newUser.email,
        fullName: newUser.fullName || null,
        memberships: newUser.organizationId
          ? [{ organizationId: newUser.organizationId, role: newUser.role as (typeof organizationRoles)[number] }]
          : []
      });
      setPasswordLink(result.actionLink);
      setNewUser({ email: "", fullName: "", organizationId: organizationOptions[0]?.id || "", role: "editor" });
      await loadAdmin();
      toast.success("Utilisateur créé. Lien de mot de passe généré.");
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "Impossible de créer l'utilisateur.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSaving(true);

    try {
      await createAdminOrganization(accessToken, { name: newOrganizationName });
      setNewOrganizationName("");
      await loadAdmin();
      toast.success("Entreprise créée.");
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "Impossible de créer l'entreprise.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserRoleChange = async (targetUser: AdminUserSummary, role: string) => {
    if (!accessToken || targetUser.memberships.length === 0) return;

    const [primaryMembership, ...rest] = targetUser.memberships;
    await updateAdminUser(accessToken, targetUser.id, {
      memberships: [
        { organizationId: primaryMembership.organizationId, role: role as (typeof organizationRoles)[number] },
        ...rest.map((membership) => ({ organizationId: membership.organizationId, role: membership.role }))
      ]
    });
    await loadAdmin();
    toast.success("Rôle mis à jour.");
  };

  const handleUserStatusToggle = async (targetUser: AdminUserSummary) => {
    if (!accessToken) return;
    await updateAdminUser(accessToken, targetUser.id, {
      status: targetUser.status === "active" ? "disabled" : "active"
    });
    await loadAdmin();
  };

  const handleResetPassword = async (targetUser: AdminUserSummary) => {
    if (!accessToken) return;
    const result = await resetAdminUserPassword(accessToken, targetUser.id);
    setPasswordLink(result.actionLink);
    toast.success("Lien de réinitialisation généré.");
  };

  const handleDeleteUser = async (targetUser: AdminUserSummary, hard: boolean) => {
    if (!accessToken) return;
    const confirmed = window.confirm(
      hard
        ? `Supprimer définitivement ${targetUser.email} ?`
        : `Désactiver ${targetUser.email} ?`
    );
    if (!confirmed) return;
    await deleteAdminUser(accessToken, targetUser.id, hard);
    await loadAdmin();
  };

  const handleOrganizationStatusToggle = async (organization: AdminOrganizationSummary) => {
    if (!accessToken) return;
    await updateAdminOrganization(accessToken, organization.id, {
      status: organization.status === "active" ? "disabled" : "active"
    });
    await loadAdmin();
  };

  const handleDeleteOrganization = async (organization: AdminOrganizationSummary, hard: boolean) => {
    if (!accessToken) return;
    const confirmed = window.confirm(
      hard
        ? `Supprimer définitivement ${organization.name} ?`
        : `Désactiver ${organization.name} ?`
    );
    if (!confirmed) return;
    await deleteAdminOrganization(accessToken, organization.id, hard);
    await loadAdmin();
  };

  const handleResetSocialConnections = async (organization: AdminOrganizationSummary) => {
    if (!accessToken) return;
    const confirmed = window.confirm(`Réinitialiser toutes les connexions sociales de ${organization.name} ?`);
    if (!confirmed) return;
    const result = await resetAdminOrganizationSocialConnections(accessToken, organization.id);
    await loadAdmin();
    toast.success(`${result.resetCount} connexion(s) réinitialisée(s).`);
  };

  if (status !== "authenticated" || isLoading) {
    return <DataState eyebrow="Admin" title="Chargement" description="Lecture des accès administrateur." loading />;
  }

  if (!canUseAdmin) {
    return <DataState eyebrow="Admin" title="Accès refusé" description="Cette page est réservée aux super-admins." />;
  }

  if (error) {
    return <DataState eyebrow="Admin" title="Chargement impossible" description={error} />;
  }

  return (
    <div className="page-stack admin-page">
      <header className="page-header">
        <span className="eyebrow">Admin</span>
        <h2>Utilisateurs, entreprises et accès</h2>
      </header>

      <div className="admin-tabs" role="tablist" aria-label="Sections admin">
        {[
          ["users", "Utilisateurs"],
          ["organizations", "Entreprises"],
          ["roles", "Rôles & accès"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? "admin-tab active" : "admin-tab"}
            onClick={() => setTab(value as AdminTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {passwordLink ? (
        <section className="panel admin-link-panel">
          <span className="eyebrow">Lien Supabase</span>
          <textarea readOnly value={passwordLink} />
        </section>
      ) : null}

      {tab === "users" ? (
        <section className="panel admin-panel">
          <form className="admin-inline-form" onSubmit={handleCreateUser}>
            <input
              type="email"
              placeholder="email@client.fr"
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <input
              placeholder="Nom complet"
              value={newUser.fullName}
              onChange={(event) => setNewUser((current) => ({ ...current, fullName: event.target.value }))}
            />
            <select
              value={newUser.organizationId}
              onChange={(event) => setNewUser((current) => ({ ...current, organizationId: event.target.value }))}
            >
              <option value="">Sans entreprise</option>
              {organizationOptions.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
            >
              {organizationRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? <Spinner size="sm" label="Création" /> : null}
              Créer
            </button>
          </form>

          <div className="admin-table">
            {users.map((entry) => {
              const primaryMembership = entry.memberships[0];
              return (
                <article className="admin-row" key={entry.id}>
                  <div>
                    <strong>{entry.fullName || entry.email}</strong>
                    <p>{entry.email}</p>
                  </div>
                  <span className={`status ${entry.status === "active" ? "status-connected" : "status-expired"}`}>
                    {entry.status}
                  </span>
                  <span className="provider-pill">{entry.platformRole}</span>
                  <span>{primaryMembership ? primaryMembership.organizationName : "Aucune entreprise"}</span>
                  {primaryMembership ? (
                    <select value={primaryMembership.role} onChange={(event) => void handleUserRoleChange(entry, event.target.value)}>
                      {organizationRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span />
                  )}
                  <div className="admin-actions">
                    <button type="button" className="secondary-button" onClick={() => void handleResetPassword(entry)}>
                      Reset
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void handleUserStatusToggle(entry)}>
                      {entry.status === "active" ? "Désactiver" : "Réactiver"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void handleDeleteUser(entry, true)}>
                      Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "organizations" ? (
        <section className="panel admin-panel">
          <form className="admin-inline-form" onSubmit={handleCreateOrganization}>
            <input
              placeholder="Nom de l'entreprise"
              value={newOrganizationName}
              onChange={(event) => setNewOrganizationName(event.target.value)}
              required
            />
            <button className="primary-button" type="submit" disabled={isSaving}>
              Créer
            </button>
          </form>

          <div className="admin-table">
            {organizations.map((organization) => (
              <article className="admin-row admin-row-organization" key={organization.id}>
                <div>
                  <strong>{organization.name}</strong>
                  <p>{organization.slug}</p>
                </div>
                <span className={`status ${organization.status === "active" ? "status-connected" : "status-expired"}`}>
                  {organization.status}
                </span>
                <span>{organization.memberCount} membre(s)</span>
                <span>{organization.socialAccountCount} compte(s)</span>
                <div className="admin-actions">
                  <button type="button" className="secondary-button" onClick={() => void handleResetSocialConnections(organization)}>
                    Reset social
                  </button>
                  <button type="button" className="secondary-button" onClick={() => void handleOrganizationStatusToggle(organization)}>
                    {organization.status === "active" ? "Désactiver" : "Réactiver"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => void handleDeleteOrganization(organization, true)}>
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "roles" ? (
        <section className="panel admin-panel">
          <div className="admin-role-grid">
            {organizationRoles.map((role) => (
              <article key={role} className="admin-role-card">
                <h3>{role}</h3>
                <ul>
                  {rolePermissions[role].map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
