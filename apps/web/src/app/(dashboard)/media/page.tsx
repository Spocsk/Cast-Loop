"use client";

import { MediaAssetSummary } from "@cast-loop/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataState } from "@/components/ui/data-state";
import { EmptyState } from "@/components/ui/empty-state";
import { GridIcon, ImageIcon, ListIcon } from "@/components/ui/icons";
import { OrganizationScope } from "@/components/ui/organization-scope";
import { useToast } from "@/components/ui/toast-provider";
import { deleteMediaAsset, fetchMediaAssets, fetchMediaAssetViewUrl } from "@/lib/api";

type MediaViewMode = "grid" | "list";

export default function MediaPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const toast = useToast();
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<MediaViewMode>("grid");
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [confirmAsset, setConfirmAsset] = useState<MediaAssetSummary | null>(null);

  const loadAssets = useCallback(async () => {
    if (!accessToken || !activeOrganizationId) {
      setAssets([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextAssets = await fetchMediaAssets(accessToken, activeOrganizationId);
      setAssets(nextAssets);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Impossible de charger les medias.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, activeOrganizationId]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    void loadAssets();
  }, [loadAssets, status]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !accessToken ||
      !activeOrganizationId ||
      assets.length === 0
    ) {
      setAssetUrls({});
      return;
    }

    let active = true;

    void Promise.allSettled(
      assets.map(async (asset) => {
        const result = await fetchMediaAssetViewUrl(accessToken, activeOrganizationId, asset.id);
        return [asset.id, result.signedUrl] as const;
      })
    ).then((results) => {
      if (!active) return;

      const nextUrls: Record<string, string> = {};

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const [assetId, signedUrl] = result.value;
        nextUrls[assetId] = signedUrl;
      }

      setAssetUrls(nextUrls);
    });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, assets, status]);

  if (isLoading || status !== "authenticated") {
    return (
      <DataState
        eyebrow="Medias"
        title="Chargement de la bibliotheque"
        description="Recuperation des assets enregistres dans Supabase."
        loading
      />
    );
  }

  if (!activeOrganizationId) {
    return (
      <DataState
        eyebrow="Medias"
        title="Aucune organisation active"
        description="Une organisation active est necessaire pour afficher la bibliotheque media."
      />
    );
  }

  if (error) {
    return <DataState eyebrow="Medias" title="Chargement impossible" description={error} />;
  }

  if (assets.length === 0) {
    return (
      <div className="page-stack media-page">
        <header className="page-header">
          <span className="eyebrow">Médias</span>
          <h2>Bibliothèque</h2>
          <OrganizationScope />
        </header>
        <section className="panel">
          <EmptyState
            icon={<ImageIcon />}
            title="Aucun média importé"
            description="Les images de ton organisation apparaîtront ici dès qu'un post aura un visuel attaché."
            actions={
              <Link href="/posts" className="secondary-button secondary-button-action">
                Créer un brouillon
              </Link>
            }
          />
        </section>
      </div>
    );
  }

  const handleDeleteAsset = async (asset: MediaAssetSummary) => {
    if (!accessToken || !activeOrganizationId) {
      return;
    }

    setPendingAssetId(asset.id);

    try {
      await deleteMediaAsset(accessToken, activeOrganizationId, asset.id);
      setAssets((currentAssets) => currentAssets.filter((currentAsset) => currentAsset.id !== asset.id));
      setAssetUrls((currentUrls) => {
        const nextUrls = { ...currentUrls };
        delete nextUrls[asset.id];
        return nextUrls;
      });
      toast.success(`${extractFileName(asset.storagePath)} a été supprimé.`);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "Impossible de supprimer ce média.");
    } finally {
      setPendingAssetId(null);
      setConfirmAsset(null);
    }
  };

  return (
    <div className="page-stack media-page">
      <header className="page-header page-header-with-action">
        <div>
          <span className="eyebrow">Medias</span>
          <h2>Bibliotheque</h2>
          <OrganizationScope />
        </div>

        <div className="media-view-toggle-group" role="tablist" aria-label="Changer la vue des médias">
          <button
            type="button"
            className="media-view-toggle-option"
            aria-selected={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
          >
            <GridIcon />
            Grille
          </button>
          <button
            type="button"
            className="media-view-toggle-option"
            aria-selected={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            <ListIcon />
            Liste
          </button>
        </div>
      </header>

      <section
        className={`media-browser ${viewMode === "grid" ? "media-browser-grid" : "media-browser-list"}`}
      >
        {assets.map((asset) => (
          <article key={asset.id} className={`panel media-card media-card-${viewMode}`}>
            <div className={`media-frame media-frame-${viewMode}`}>
              {assetUrls[asset.id] ? (
                <img
                  src={assetUrls[asset.id]}
                  alt={extractFileName(asset.storagePath)}
                  className="media-image"
                />
              ) : (
                <div className="media-placeholder">
                  <span>Preview indisponible</span>
                </div>
              )}
            </div>

            <div className="media-copy">
              <strong>{extractFileName(asset.storagePath)}</strong>
              <p>{formatDimensions(asset.width, asset.height)}</p>
              <p className="muted">
                {asset.mimeType} · {formatFileSize(asset.fileSizeBytes)}
              </p>
              <div className="media-card-actions">
                <button
                  type="button"
                  className="secondary-button secondary-button-action media-card-delete-button"
                  onClick={() => setConfirmAsset(asset)}
                  disabled={pendingAssetId === asset.id}
                >
                  {pendingAssetId === asset.id ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <ConfirmDialog
        open={confirmAsset !== null}
        title="Supprimer ce média ?"
        description={
          confirmAsset
            ? `Le média ${extractFileName(confirmAsset.storagePath)} sera retiré de la bibliothèque de l'organisation active.`
            : ""
        }
        tone="danger"
        confirmLabel="Supprimer"
        busy={Boolean(confirmAsset && pendingAssetId === confirmAsset.id)}
        onCancel={() => setConfirmAsset(null)}
        onConfirm={() => {
          if (!confirmAsset) {
            return;
          }

          void handleDeleteAsset(confirmAsset);
        }}
      />
    </div>
  );
}

const extractFileName = (storagePath: string) => storagePath.split("/").at(-1) ?? storagePath;

const formatDimensions = (width: number | null, height: number | null) => {
  if (!width || !height) {
    return "Dimensions inconnues";
  }

  return `${width} x ${height}`;
};

const formatFileSize = (fileSizeBytes: number) => {
  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`;
  }

  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};
