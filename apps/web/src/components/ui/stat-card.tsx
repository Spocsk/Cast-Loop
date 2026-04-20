import clsx from "clsx";

export function StatCard({
  label,
  value,
  hint,
  className
}: {
  label: string;
  value: string | number;
  hint: string;
  className?: string;
}) {
  return (
    <article className={clsx("panel stat-card", className)}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}
