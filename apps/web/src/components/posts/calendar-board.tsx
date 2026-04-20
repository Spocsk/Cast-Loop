"use client";

import { CalendarPostItem } from "@cast-loop/shared";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dropdown } from "../ui/dropdown";
import { EmptyState } from "../ui/empty-state";
import { InboxIcon } from "../ui/icons";
import { ProviderPill } from "../ui/provider-pill";

export function CalendarBoard({ items }: { items: CalendarPostItem[] }) {
  const router = useRouter();
  const [view, setView] = useState("month");

  return (
    <div className="panel timeline-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Calendrier</span>
          <h2>Prochaines publications</h2>
        </div>
        <div className="timeline-view-control">
          <Dropdown
            options={[
              { value: "month", label: "Vue mensuelle", hint: "Panorama éditorial" },
              { value: "week", label: "Vue hebdomadaire", hint: "Prochaines échéances" },
              { value: "day", label: "Vue quotidienne", hint: "Focus opérationnel" }
            ]}
            value={view}
            onChange={setView}
            label="Choisir une vue du calendrier"
          />
        </div>
      </div>

      <div className="timeline">
        {items.length > 0 ? (
          items.map((item) => {
            const providers = Array.isArray(item.providers) ? item.providers : [];

            return (
              <article
                key={item.id}
                className="timeline-row timeline-row-clickable"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/posts?postId=${item.id}` as Route)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/posts?postId=${item.id}` as Route);
                  }
                }}
              >
                <div className="timeline-date">
                  <strong>{new Date(item.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</strong>
                  <span>{new Date(item.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="timeline-content">
                  <strong>{item.title}</strong>
                  <div className="provider-stack">
                    {providers.map((provider) => (
                      <ProviderPill key={`${item.id}-${provider}`} provider={provider} />
                    ))}
                  </div>
                </div>
                <span className={`status status-${item.state}`}>{item.state}</span>
              </article>
            );
          })
        ) : (
          <EmptyState
            icon={<InboxIcon />}
            title="Aucune publication planifiée"
            description="Les prochains posts programmés apparaîtront ici dès qu'un brouillon sera planifié."
          />
        )}
      </div>
    </div>
  );
}
