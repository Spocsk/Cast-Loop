"use client";

import { PostSummary, PostVisibility } from "@cast-loop/shared";
import { useCallback, useEffect, useState } from "react";
import { PostsTable } from "@/components/posts/posts-table";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { fetchPosts } from "@/lib/api";

export default function PostsPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("active");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    if (!accessToken || !activeOrganizationId) return;
    try {
      const nextPosts = await fetchPosts(accessToken, activeOrganizationId, undefined, visibility);
      setPosts(nextPosts);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Impossible de charger les publications.");
    }
  }, [accessToken, activeOrganizationId, visibility]);

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

    void fetchPosts(accessToken, activeOrganizationId, undefined, visibility)
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
  }, [accessToken, activeOrganizationId, status, visibility]);

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
      <PostsTable
        items={posts}
        onRefresh={loadPosts}
        manageMode
        visibility={visibility}
        onVisibilityChange={setVisibility}
      />
    </div>
  );
}
