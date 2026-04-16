"use client";

import { MediaAssetSummary } from "@cast-loop/shared";
import { useEffect, useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { DataState } from "@/components/ui/data-state";
import { fetchMediaAssets } from "@/lib/api";

export default function MediaPage() {
  const { accessToken, activeOrganizationId, status } = useSessionContext();
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Medias</span>
        <h2>Bibliotheque</h2>
      </header>

      <section className="grid-tiles">
        {assets.map((asset) => (
          <article key={asset.id} className="panel media-card">
            <div className="media-placeholder" />
            <strong>{extractFileName(asset.storagePath)}</strong>
            <p>{formatDimensions(asset.width, asset.height)}</p>
            <p className="muted">
              {asset.mimeType} · {formatFileSize(asset.fileSizeBytes)}
            </p>
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
