import { mediaLibrary } from "@/lib/mock-data";

export default function MediaPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Medias</span>
        <h2>Bibliotheque</h2>
      </header>

      <section className="grid-tiles">
        {mediaLibrary.map((asset) => (
          <article key={asset.id} className="panel media-card">
            <div className="media-placeholder" />
            <strong>{asset.label}</strong>
            <p>{asset.dimensions}</p>
            <p className="muted">
              {asset.type} · {asset.size}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
