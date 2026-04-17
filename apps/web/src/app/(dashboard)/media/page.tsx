"use client";

import { MediaAssetSummary } from "@cast-loop/shared";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { fetchMediaAssets, fetchMediaAssetViewUrl } from "@/lib/api";

type MediaViewMode = "grid" | "list";

export default function MediaPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<MediaViewMode>("grid");

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!accessToken || !activeOrganizationId) {
      setAssets([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void fetchMediaAssets(accessToken, activeOrganizationId)
      .then((nextAssets) => {
        if (!active) return;
        setAssets(nextAssets);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Impossible de charger les medias.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, status]);

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
      <DataState
        eyebrow="Medias"
        title="Aucun media importe"
        description="Les images uploadees dans Supabase apparaitront ici avec leurs metadonnees."
      />
    );
  }

  return (
    <div className="page-stack media-page">
      <header className="page-header page-header-with-action">
        <div>
          <span className="eyebrow">Medias</span>
          <h2>Bibliotheque</h2>
        </div>

        <button
          type="button"
          className="media-view-toggle"
          onClick={() => setViewMode((current) => (current === "grid" ? "list" : "grid"))}
          aria-pressed={viewMode === "list"}
        >
          {viewMode === "grid" ? "Vue liste" : "Vue grille"}
        </button>
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
            </div>
          </article>
        ))}
      </section>
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
