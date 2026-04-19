import { Spinner } from "./spinner";

export function DataState({
  eyebrow,
  title,
  description,
  loading = false
}: {
  eyebrow: string;
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <section className={`panel data-state${loading ? " data-state-loading" : ""}`}>
      <span className="eyebrow">{eyebrow}</span>
      {loading ? <Spinner size="lg" label="Chargement en cours" className="data-state-spinner" /> : null}
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
