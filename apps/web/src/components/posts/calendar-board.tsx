"use client";

import { CalendarPostItem } from "@cast-loop/shared";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dropdown } from "../ui/dropdown";
import { EmptyState } from "../ui/empty-state";
import { InboxIcon } from "../ui/icons";
import { ProviderPill } from "../ui/provider-pill";

interface CalendarBoardProps {
  items: CalendarPostItem[];
  maxItems?: number;
  browseHref?: Route;
  browseLabel?: string;
  showViewModes?: boolean;
}

const CALENDAR_VIEW_MODES = [
  { value: "month", label: "Mois", hint: "Panorama éditorial" },
  { value: "week", label: "Semaine", hint: "Fenêtre resserrée" },
  { value: "day", label: "Jour", hint: "Focus opérationnel" }
] as const;

export function CalendarBoard({
  items,
  maxItems,
  browseHref,
  browseLabel,
  showViewModes = true
}: CalendarBoardProps) {
  const router = useRouter();
  const [view, setView] = useState<(typeof CALENDAR_VIEW_MODES)[number]["value"]>("month");
  const visibleItems = typeof maxItems === "number" ? items.slice(0, maxItems) : items;
  const hiddenItemsCount = Math.max(items.length - visibleItems.length, 0);
  const activeView = CALENDAR_VIEW_MODES.find((mode) => mode.value === view) ?? CALENDAR_VIEW_MODES[0];

  return (
    <div className="panel timeline-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Calendrier</span>
          <h2>Prochaines publications</h2>
        </div>
        <div className="section-heading-actions">
          {showViewModes ? (
            <div className="timeline-view-control">
              <Dropdown
                options={CALENDAR_VIEW_MODES.map((mode) => ({
                  value: mode.value,
                  label: mode.label,
                  hint: mode.hint
                }))}
                value={view}
                onChange={(nextValue) => setView(nextValue as (typeof CALENDAR_VIEW_MODES)[number]["value"])}
                label="Choisir une vue du calendrier"
              />
            </div>
          ) : null}
          {browseHref ? (
            <Link href={browseHref} className="section-link-subtle">
              {browseLabel ?? "Voir tout"}
              {hiddenItemsCount > 0 ? ` (${hiddenItemsCount} de plus)` : ""}
            </Link>
          ) : null}
        </div>
      </div>
      {showViewModes ? <p className="timeline-view-caption">{activeView.hint}</p> : null}

      <div className={`timeline timeline-view-${view}`}>
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => {
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
