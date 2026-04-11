import { PostSummary } from "@cast-loop/shared";

export function PostsTable({ items }: { items: PostSummary[] }) {
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Posts</span>
          <h2>Pipeline editorial</h2>
        </div>
        <button className="secondary-button">Nouveau draft</button>
      </div>

      <div className="table-list">
        {items.map((post) => (
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
              <strong>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString("fr-FR") : "Brouillon"}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
