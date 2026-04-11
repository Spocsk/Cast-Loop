import { mediaLibrary } from "@/lib/mock-data";

export default function MediaPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Bibliotheque media</span>
        <h2>Assets stockes dans Supabase Storage</h2>
        <p>Les uploads passent par une URL signee generee par Nest, puis l'asset est reference dans `media_assets`.</p>
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
