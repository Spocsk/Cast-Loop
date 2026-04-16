"use client";

import { PostSummary } from "@cast-loop/shared";
import { useEffect, useState } from "react";
import { PostsTable } from "@/components/posts/posts-table";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { fetchPosts } from "@/lib/api";

export default function PostsPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken || !activeOrganizationId) {
      setPosts([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void fetchPosts(accessToken, activeOrganizationId)
      .then((nextPosts) => {
        if (!active) return;
        setPosts(nextPosts);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger les publications.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, status]);

  if (isLoading || status !== "authenticated") {
    return (
      <DataState
        eyebrow="Posts"
        title="Chargement des publications"
        description="Synchronisation de la liste des posts depuis Supabase."
      />
    );
  }

  if (!activeOrganizationId) {
    return (
      <DataState
        eyebrow="Posts"
        title="Aucune organisation active"
        description="Connecte un compte rattache a une organisation pour voir les publications."
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Posts" title="Chargement impossible" description={error} />;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Posts</span>
        <h2>Publications et brouillons</h2>
      </header>
      {posts.length > 0 ? (
        <PostsTable items={posts} />
      ) : (
        <DataState
          eyebrow="Posts"
          title="Aucun post en base"
          description="Les brouillons et publications apparaitront ici des qu'ils existent dans Supabase."
        />
      )}
    </div>
  );
}
