import { PostsTable } from "@/components/posts/posts-table";
import { getDashboardSnapshot } from "@/lib/api";

export default async function PostsPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Posts</span>
        <h2>Drafts, publications immediates et programmation</h2>
        <p>Le backend gere les transitions `draft`, `scheduled`, `publishing`, `published`, `failed` et `cancelled`.</p>
      </header>
      <PostsTable items={snapshot.posts} />
    </div>
  );
}
