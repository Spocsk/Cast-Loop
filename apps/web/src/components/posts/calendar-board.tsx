import { CalendarPostItem } from "@cast-loop/shared";
import { ProviderPill } from "../ui/provider-pill";

export function CalendarBoard({ items }: { items: CalendarPostItem[] }) {
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Calendrier</span>
          <h2>Prochaines publications</h2>
        </div>
        <button className="secondary-button">Vue mensuelle</button>
      </div>

      <div className="timeline">
        {items.map((item) => (
          <article key={item.id} className="timeline-row">
            <div className="timeline-date">
              <strong>{new Date(item.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</strong>
              <span>{new Date(item.scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="timeline-content">
              <strong>{item.title}</strong>
              <div className="provider-stack">
                {item.providers.map((provider) => (
                  <ProviderPill key={`${item.id}-${provider}`} provider={provider} />
                ))}
              </div>
            </div>
            <span className={`status status-${item.state}`}>{item.state}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
