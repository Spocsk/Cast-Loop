import { CalendarBoard } from "@/components/posts/calendar-board";
import { getDashboardSnapshot } from "@/lib/api";

export default async function CalendarPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Calendrier</span>
        <h2>Programmation hebdomadaire</h2>
      </header>
      <CalendarBoard items={snapshot.calendarItems} />
    </div>
  );
}
