import { organizations } from "@/lib/mock-data";

export default function CompaniesPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Entreprises</span>
        <h2>Organisations</h2>
      </header>

      <div className="grid-tiles">
        {organizations.map((organization) => (
          <article className="panel" key={organization.id}>
            <span className="eyebrow">{organization.role}</span>
            <strong>{organization.name}</strong>
            <p>{organization.slug}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
