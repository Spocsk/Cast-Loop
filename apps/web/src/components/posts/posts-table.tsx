import { PostSummary } from "@cast-loop/shared";

export function PostsTable({ items }: { items: PostSummary[] }) {
  return (
    <div className="panel posts-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Posts</span>
          <h2>Pipeline editorial</h2>
        </div>
        <button className="secondary-button secondary-button-action" type="button">
          Nouveau draft
        </button>
      </div>

      <div className="table-list">
        {items.length > 0 ? (
          items.map((post) => (
            <article key={post.id} className="table-row">
              <div>
                <strong>{post.title}</strong>
                <p>{post.content}</p>
              </div>
              <div>
                <span className={`status status-${post.state}`}>{post.state}</span>
              </div>
              <div>
                <strong>{post.targetCount}</strong>
                <p>cibles</p>
              </div>
              <div>
                <strong>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Brouillon"}</strong>
              </div>
            </article>
          ))
        ) : (
          <div className="table-row">
            <div>
              <strong>Aucun post disponible</strong>
              <p>Creer un brouillon remplira automatiquement cette liste.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
