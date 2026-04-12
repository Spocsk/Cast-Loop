import { PostsTable } from "@/components/posts/posts-table";
import { getDashboardSnapshot } from "@/lib/api";

export default async function PostsPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Posts</span>
        <h2>Publications et brouillons</h2>
      </header>
      <PostsTable items={snapshot.posts} />
    </div>
  );
}
