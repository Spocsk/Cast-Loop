"use client";

import { CalendarPostItem } from "@cast-loop/shared";
import { useEffect, useState } from "react";
import { CalendarBoard } from "@/components/posts/calendar-board";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { OrganizationScope } from "@/components/ui/organization-scope";
import { fetchCalendar } from "@/lib/api";

export default function CalendarPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [items, setItems] = useState<CalendarPostItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken || !activeOrganizationId) {
      setItems([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const range = getCalendarRange();
    let active = true;
    setIsLoading(true);
    setError(null);

    void fetchCalendar(accessToken, activeOrganizationId, range.from, range.to)
      .then((nextItems) => {
        if (!active) return;
        setItems(nextItems);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger le calendrier.");
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
        eyebrow="Calendrier"
        title="Chargement des publications"
        description="Lecture des posts planifies depuis la base Supabase."
        loading
      />
    );
  }

  if (!activeOrganizationId) {
    return (
      <DataState
        eyebrow="Calendrier"
        title="Aucune organisation active"
        description="Une organisation active est necessaire pour afficher le calendrier."
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Calendrier" title="Chargement impossible" description={error} />;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Calendrier</span>
        <h2>Programmation editoriale</h2>
        <OrganizationScope />
      </header>
      {items.length > 0 ? (
        <CalendarBoard items={items} />
      ) : (
        <DataState
          eyebrow="Calendrier"
          title="Aucune publication planifiee"
          description="Les prochaines publications apparaitront ici des qu'un post aura une date de programmation."
        />
      )}
    </div>
  );
}

const getCalendarRange = () => {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  from.setMonth(from.getMonth() - 1);
  to.setMonth(to.getMonth() + 6);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
};
