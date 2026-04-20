"use client";

import { useSessionContext } from "@/components/providers/session-provider";

export function OrganizationScope() {
  const { activeOrganization } = useSessionContext();

  if (!activeOrganization) {
    return null;
  }

  return (
    <p className="page-scope">
      Entreprise active : <strong>{activeOrganization.name}</strong>
    </p>
  );
}
