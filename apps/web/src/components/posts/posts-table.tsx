"use client";

import { PostSummary, PostVisibility } from "@cast-loop/shared";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { InboxIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { archivePost, deletePost, restorePost } from "@/lib/api";
import { CreatePostDialog } from "./create-post-dialog";
import { PostDetailsDialog } from "./post-details-dialog";

interface PostsTableProps {
  items: PostSummary[];
  onRefresh?: () => void;
  manageMode?: boolean;
  visibility?: PostVisibility;
  onVisibilityChange?: (visibility: PostVisibility) => void;
  selectedPostId?: string | null;
  onPostDetailsOpen?: (postId: string) => void;
  onPostDetailsClose?: () => void;
  maxItems?: number;
  browseHref?: Route;
  browseLabel?: string;
}

export function PostsTable({
  items,
  onRefresh,
  manageMode = false,
  visibility = "active",
  onVisibilityChange,
  selectedPostId = null,
  onPostDetailsOpen,
  onPostDetailsClose,
  maxItems,
  browseHref,
  browseLabel
}: PostsTableProps) {
  const { accessToken, activeOrganizationId } = useSessionContext();
  const toast = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostSummary | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: "archive" | "delete";
    postId: string;
  } | null>(null);
  const visibleItems = typeof maxItems === "number" ? items.slice(0, maxItems) : items;
  const hiddenItemsCount = Math.max(items.length - visibleItems.length, 0);

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
    onPostDetailsOpen?.(post.id);
  };

  const closePostDetails = () => {
    setSelectedPost(null);
    onPostDetailsClose?.();
  };

  useEffect(() => {
    if (!selectedPostId) {
      setSelectedPost(null);
      return;
    }

    const post = items.find((item) => item.id === selectedPostId) ?? null;

    if (post) {
      setSelectedPost(post);
    }
  }, [items, selectedPostId]);

  const runMutation = async (postId: string, mutation: () => Promise<void>) => {
    setActionError(null);
    setPendingPostId(postId);

    try {
      await mutation();
      await onRefresh?.();
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action impossible sur ce post.");
      return false;
    } finally {
      setPendingPostId(null);
    }
  };

  const handleArchive = async (postId: string) => {
    if (!accessToken || !activeOrganizationId) return;
    const success = await runMutation(postId, async () => {
      await archivePost(accessToken, postId, activeOrganizationId);
    });
    if (success) {
      toast.success("Le post a été archivé.");
    }
  };

  const handleRestore = async (postId: string) => {
    if (!accessToken || !activeOrganizationId) return;
    const success = await runMutation(postId, async () => {
      await restorePost(accessToken, postId, activeOrganizationId);
    });
    if (success) {
      toast.success("Le post a été restauré.");
    }
  };

  const handleDelete = async (postId: string) => {
    if (!accessToken || !activeOrganizationId) return;
    const success = await runMutation(postId, async () => {
      await deletePost(accessToken, postId, activeOrganizationId);
    });
    if (success) {
      toast.success("Le post a été supprimé.");
    }
  };

  const runConfirmedAction = async () => {
    if (!confirm) return;
    const { kind, postId } = confirm;
    setConfirm(null);
    if (kind === "archive") {
      await handleArchive(postId);
    } else {
      await handleDelete(postId);
    }
  };

  return (
    <div className="panel posts-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Posts</span>
          <h2>Pipeline éditorial</h2>
        </div>
        <div className="section-heading-actions">
          <button
            className="secondary-button secondary-button-action"
            type="button"
            onClick={openCreateDialog}
          >
            Nouveau draft
          </button>
          {browseHref ? (
            <Link href={browseHref} className="section-link-subtle">
              {browseLabel ?? "Voir tous les posts"}
              {hiddenItemsCount > 0 ? ` (${hiddenItemsCount} de plus)` : ""}
            </Link>
          ) : null}
        </div>
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
        {visibleItems.length > 0 ? (
          visibleItems.map((post) => (
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
              <div className="post-row-summary">
                <strong className="post-row-title">{post.title}</strong>
                <p className="post-row-excerpt">{post.content}</p>
              </div>
              <div className="post-row-status">
                <span className={`status status-${post.state}`}>{post.state}</span>
              </div>
              <div className="post-row-targets">
                <strong>{post.targetCount}</strong>
                <p>cibles</p>
              </div>
              <div className="post-row-date">
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
                          setConfirm({ kind: "archive", postId: post.id });
                        }}
                        disabled={pendingPostId === post.id || !isMutable(post)}
                      >
                        {pendingPostId === post.id ? (
                          <>
                            <Spinner size="sm" label="Archivage" />
                            Archivage…
                          </>
                        ) : (
                          "Archiver"
                        )}
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
                        {pendingPostId === post.id ? (
                          <>
                            <Spinner size="sm" label="Restauration" />
                            Restauration…
                          </>
                        ) : (
                          "Restaurer"
                        )}
                      </button>
                      <button
                        type="button"
                        className="post-row-button post-row-button-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirm({ kind: "delete", postId: post.id });
                        }}
                        disabled={pendingPostId === post.id}
                      >
                        {pendingPostId === post.id ? (
                          <>
                            <Spinner size="sm" label="Suppression" />
                            Suppression…
                          </>
                        ) : (
                          "Supprimer"
                        )}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState
            icon={<InboxIcon />}
            title={visibility === "archived" ? "Aucun post archivé" : "Aucun post disponible"}
            description={
              visibility === "archived"
                ? "Les posts archivés apparaîtront ici pour être restaurés ou supprimés."
                : "Crée ton premier brouillon pour commencer à remplir le pipeline éditorial."
            }
            actions={
              visibility === "active" ? (
                <button
                  type="button"
                  className="secondary-button secondary-button-action"
                  onClick={openCreateDialog}
                >
                  Nouveau brouillon
                </button>
              ) : undefined
            }
          />
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
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete" ? "Supprimer ce post ?" : "Archiver ce post ?"}
        description={
          confirm?.kind === "delete"
            ? "Cette suppression est définitive et retirera le post de l'organisation active."
            : "Le post sera retiré de la vue active mais pourra encore être restauré plus tard."
        }
        tone={confirm?.kind === "delete" ? "danger" : "default"}
        confirmLabel={confirm?.kind === "delete" ? "Supprimer" : "Archiver"}
        busy={Boolean(confirm?.postId && pendingPostId === confirm.postId)}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirmedAction}
      />
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
