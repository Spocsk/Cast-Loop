"use client";

import { MediaAssetSummary, PostSummary, SocialAccountSummary } from "@cast-loop/shared";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionContext } from "@/components/providers/session-provider";
import { ProviderPill } from "@/components/ui/provider-pill";
import { fetchMediaAssetViewUrl, fetchMediaAssets, fetchSocialAccounts } from "@/lib/api";

interface PostDetailsDialogProps {
  open: boolean;
  post: PostSummary | null;
  onClose: () => void;
}

export function PostDetailsDialog({ open, post, onClose }: PostDetailsDialogProps) {
  const { accessToken, activeOrganizationId } = useSessionContext();
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetSummary[]>([]);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaPreviewError, setMediaPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !post || !accessToken || !activeOrganizationId) {
      return;
    }

    let active = true;
    setError(null);
    setMediaPreviewError(null);

    Promise.all([
      fetchSocialAccounts(accessToken, activeOrganizationId),
      fetchMediaAssets(accessToken, activeOrganizationId)
    ])
      .then(([nextAccounts, nextMedia]) => {
        if (!active) return;
        setAccounts(nextAccounts);
        setMediaAssets(nextMedia);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger les details du post.");
      });

    return () => {
      active = false;
    };
  }, [open, post, accessToken, activeOrganizationId]);

  const targetAccounts = useMemo(() => {
    if (!post) return [];
    return accounts.filter((account) => post.targetSocialAccountIds.includes(account.id));
  }, [accounts, post]);

  const mediaAsset = useMemo(() => {
    if (!post?.primaryMediaAssetId) return null;
    return mediaAssets.find((asset) => asset.id === post.primaryMediaAssetId) ?? null;
  }, [mediaAssets, post]);

  useEffect(() => {
    if (!open || !post?.primaryMediaAssetId || !accessToken || !activeOrganizationId) {
      setMediaPreviewUrl(null);
      setMediaPreviewError(null);
      return;
    }

    let active = true;
    setMediaPreviewError(null);

    fetchMediaAssetViewUrl(accessToken, activeOrganizationId, post.primaryMediaAssetId)
      .then((result) => {
        if (!active) return;
        setMediaPreviewUrl(result.signedUrl);
      })
      .catch((nextError) => {
        if (!active) return;
        setMediaPreviewUrl(null);
        setMediaPreviewError(nextError instanceof Error ? nextError.message : "Impossible d'afficher l'image.");
      });

    return () => {
      active = false;
    };
  }, [open, post, accessToken, activeOrganizationId]);

  if (!open || !post || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-details-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="dialog-shell dialog-shell--lg">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Details du post</span>
            <h2 id="post-details-title">{post.title}</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="posts-details-grid">
          <section className="dialog-section">
            <span className="eyebrow">Statut</span>
            <div className="posts-details-status-row">
              <span className={`status status-${post.state}`}>{post.state}</span>
              <span className="muted">{formatPostMeta(post)}</span>
            </div>
          </section>

          <section className="dialog-section">
            <span className="eyebrow">Contenu</span>
            <p className="posts-details-copy">{post.content}</p>
          </section>

          <section className="dialog-section">
            <span className="eyebrow">Comptes cibles</span>
            {targetAccounts.length > 0 ? (
              <div className="posts-details-targets">
                {targetAccounts.map((account) => (
                  <div key={account.id} className="posts-details-target-card">
                    <ProviderPill provider={account.provider} />
                    <strong>{account.displayName}</strong>
                    <p>
                      {account.handle} · {account.status}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Aucun compte cible selectionne.</p>
            )}
          </section>

          <section className="dialog-section">
            <span className="eyebrow">Image</span>
            {mediaAsset ? (
              <div className="posts-details-media">
                {mediaPreviewUrl ? (
                  <img
                    src={mediaPreviewUrl}
                    alt={post.title}
                    className="posts-details-media-preview"
                  />
                ) : null}
                <strong>{mediaAsset.storagePath.split("/").at(-1) ?? mediaAsset.storagePath}</strong>
                <p>{mediaAsset.mimeType}</p>
                {mediaPreviewError ? <p className="posts-feedback-error">{mediaPreviewError}</p> : null}
              </div>
            ) : (
              <p className="muted">Aucune image associee.</p>
            )}
          </section>
        </div>

        {error ? <p className="posts-feedback-error">{error}</p> : null}
      </div>
    </div>,
    document.body
  );
}

const formatPostMeta = (post: PostSummary) => {
  if (post.archivedAt) {
    return `Archive le ${new Date(post.archivedAt).toLocaleDateString("fr-FR")}`;
  }

  if (post.scheduledAt) {
    return `Programme le ${new Date(post.scheduledAt).toLocaleString("fr-FR")}`;
  }

  return "Brouillon sans date de publication";
};
