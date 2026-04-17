"use client";

import { PostSummary, PostVisibility } from "@cast-loop/shared";
import { useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { archivePost, deletePost, restorePost } from "@/lib/api";
import { CreatePostDialog } from "./create-post-dialog";
import { PostDetailsDialog } from "./post-details-dialog";

interface PostsTableProps {
  items: PostSummary[];
  onRefresh?: () => void;
  manageMode?: boolean;
  visibility?: PostVisibility;
  onVisibilityChange?: (visibility: PostVisibility) => void;
}

export function PostsTable({
  items,
  onRefresh,
  manageMode = false,
  visibility = "active",
  onVisibilityChange
}: PostsTableProps) {
  const { accessToken, activeOrganizationId } = useSessionContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostSummary | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingPost(null);
    setActionError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (post: PostSummary) => {
    setEditingPost(post);
    setActionError(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setEditingPost(null);
    setIsDialogOpen(false);
  };

  const openPostDetails = (post: PostSummary) => {
    setSelectedPost(post);
  };

  const closePostDetails = () => {
    setSelectedPost(null);
  };

  const runMutation = async (postId: string, mutation: () => Promise<void>) => {
    setActionError(null);
    setPendingPostId(postId);

    try {
      await mutation();
      await onRefresh?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action impossible sur ce post.");
    } finally {
      setPendingPostId(null);
    }
  };

  const handleArchive = async (postId: string) => {
    if (!accessToken || !activeOrganizationId) return;
    await runMutation(postId, async () => {
      await archivePost(accessToken, postId, activeOrganizationId);
    });
  };

  const handleRestore = async (postId: string) => {
    if (!accessToken || !activeOrganizationId) return;
    await runMutation(postId, async () => {
      await restorePost(accessToken, postId, activeOrganizationId);
    });
  };

  const handleDelete = async (postId: string) => {
    if (!accessToken || !activeOrganizationId) return;
    if (!window.confirm("Supprimer definitivement ce post archive ?")) {
      return;
    }

    await runMutation(postId, async () => {
      await deletePost(accessToken, postId, activeOrganizationId);
    });
  };

  return (
    <div className="panel posts-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Posts</span>
          <h2>Pipeline editorial</h2>
        </div>
        <button
          className="secondary-button secondary-button-action"
          type="button"
          onClick={openCreateDialog}
        >
          Nouveau draft
        </button>
      </div>

      {manageMode ? (
        <div className="posts-visibility-tabs" role="tablist" aria-label="Filtres des posts">
          <button
            type="button"
            className={visibility === "active" ? "posts-visibility-tab posts-visibility-tab-active" : "posts-visibility-tab"}
            onClick={() => onVisibilityChange?.("active")}
          >
            Actifs
          </button>
          <button
            type="button"
            className={visibility === "archived" ? "posts-visibility-tab posts-visibility-tab-active" : "posts-visibility-tab"}
            onClick={() => onVisibilityChange?.("archived")}
          >
            Archives
          </button>
        </div>
      ) : null}

      {actionError ? <p className="posts-feedback-error">{actionError}</p> : null}

      <div className="table-list posts-table-list">
        {items.length > 0 ? (
          items.map((post) => (
            <article
              key={post.id}
              className={
                manageMode
                  ? "table-row table-row-posts table-row-posts-manage table-row-posts-clickable"
                  : "table-row table-row-posts table-row-posts-clickable"
              }
              role="button"
              tabIndex={0}
              onClick={() => openPostDetails(post)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPostDetails(post);
                }
              }}
            >
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
                <strong>{formatPostDate(post)}</strong>
              </div>
              {manageMode ? (
                <div className="post-row-actions">
                  {visibility === "active" ? (
                    <>
                      <button
                        type="button"
                        className="post-row-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditDialog(post);
                        }}
                        disabled={pendingPostId === post.id || !isMutable(post)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="post-row-button post-row-button-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleArchive(post.id);
                        }}
                        disabled={pendingPostId === post.id || !isMutable(post)}
                      >
                        {pendingPostId === post.id ? "Archivage…" : "Archiver"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="post-row-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRestore(post.id);
                        }}
                        disabled={pendingPostId === post.id}
                      >
                        {pendingPostId === post.id ? "Restauration…" : "Restaurer"}
                      </button>
                      <button
                        type="button"
                        className="post-row-button post-row-button-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(post.id);
                        }}
                        disabled={pendingPostId === post.id}
                      >
                        {pendingPostId === post.id ? "Suppression…" : "Supprimer"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="table-row">
            <div>
              <strong>{visibility === "archived" ? "Aucun post archive" : "Aucun post disponible"}</strong>
              <p>
                {visibility === "archived"
                  ? "Les posts archives apparaitront ici pour etre restaures ou supprimes."
                  : "Creer un brouillon remplira automatiquement cette liste."}
              </p>
            </div>
          </div>
        )}
      </div>

      <CreatePostDialog
        open={isDialogOpen}
        post={editingPost}
        onClose={handleDialogClose}
        onSaved={() => {
          onRefresh?.();
        }}
      />

      <PostDetailsDialog open={selectedPost !== null} post={selectedPost} onClose={closePostDetails} />
    </div>
  );
}

const isMutable = (post: PostSummary) => post.state === "draft" || post.state === "scheduled";

const formatPostDate = (post: PostSummary) => {
  if (post.archivedAt) {
    return `Archive le ${new Date(post.archivedAt).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })}`;
  }

  return post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Brouillon";
};
