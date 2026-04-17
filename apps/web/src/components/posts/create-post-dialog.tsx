"use client";

import { MediaAssetSummary, PostSummary, SocialAccountSummary } from "@cast-loop/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionContext } from "@/components/providers/session-provider";
import {
  createMediaUploadUrl,
  createPost,
  fetchMediaAssets,
  fetchSocialAccounts,
  updatePost,
  uploadImageToSignedUrl
} from "@/lib/api";

interface CreatePostDialogProps {
  open: boolean;
  post?: PostSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "draft" | "scheduled";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(26, 18, 11, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  zIndex: 1000
};

const dialogStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  maxHeight: "calc(100vh - 2rem)",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  background: "var(--panel-strong)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius-md)",
  padding: "1.5rem",
  boxShadow: "var(--shadow)"
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontSize: "0.9rem"
};

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line-strong)",
  background: "var(--panel-strong)",
  color: "var(--ink)"
};

export function CreatePostDialog({ open, post, onClose, onSaved }: CreatePostDialogProps) {
  const { accessToken, activeOrganizationId } = useSessionContext();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<Mode>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaAssetSummary[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [mounted, setMounted] = useState(false);
  const isEditing = Boolean(post);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const resetState = () => {
    setTitle("");
    setContent("");
    setMode("draft");
    setScheduledAt("");
    setSelectedAccountIds([]);
    setMediaAssetId(null);
    setUploadStatus("idle");
    setUploadError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(post?.title ?? "");
    setContent(post?.content ?? "");
    setMode(post?.scheduledAt ? "scheduled" : "draft");
    setScheduledAt(post?.scheduledAt ? toDateTimeLocalValue(post.scheduledAt) : "");
    setSelectedAccountIds(post?.targetSocialAccountIds ?? []);
    setMediaAssetId(post?.primaryMediaAssetId ?? null);
    setUploadStatus("idle");
    setUploadError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [open, post]);

  const handleClose = () => {
    uploadAbortRef.current?.abort();
    resetState();
    onClose();
  };

  useEffect(() => {
    if (!open || !accessToken || !activeOrganizationId) {
      return;
    }

    let active = true;
    setIsLoadingLists(true);

    Promise.all([
      fetchSocialAccounts(accessToken, activeOrganizationId),
      fetchMediaAssets(accessToken, activeOrganizationId)
    ])
      .then(([nextAccounts, nextMedia]) => {
        if (!active) return;
        setAccounts(nextAccounts);
        setExistingMedia(nextMedia);
      })
      .catch((error) => {
        if (!active) return;
        setSubmitError(error instanceof Error ? error.message : "Chargement impossible");
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingLists(false);
      });

    return () => {
      active = false;
    };
  }, [open, accessToken, activeOrganizationId]);

  if (!open || !mounted) {
    return null;
  }

  const handleFile = async (file: File) => {
    if (!accessToken || !activeOrganizationId) return;

    setUploadError(null);
    setUploadStatus("uploading");
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = new AbortController();

    try {
      const uploadInfo = await createMediaUploadUrl(accessToken, {
        organizationId: activeOrganizationId,
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size
      });

      await uploadImageToSignedUrl({
        bucket: uploadInfo.bucket,
        path: uploadInfo.path,
        token: uploadInfo.token,
        file
      });

      setMediaAssetId(uploadInfo.assetId);
      setUploadStatus("done");
    } catch (error) {
      setUploadStatus("error");
      setUploadError(error instanceof Error ? error.message : "Echec de l'upload");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !activeOrganizationId) return;

    setSubmitError(null);

    if (title.trim().length === 0 || content.trim().length === 0) {
      setSubmitError("Le titre et le contenu sont obligatoires.");
      return;
    }

    if (mode === "scheduled") {
      if (!scheduledAt) {
        setSubmitError("Veuillez choisir une date et une heure de publication.");
        return;
      }
      if (selectedAccountIds.length === 0) {
        setSubmitError("Selectionnez au moins un compte connecte pour planifier.");
        return;
      }
      const disconnectedTarget = selectedAccountIds.some((accountId) => {
        const account = accounts.find((item) => item.id === accountId);
        return account?.status !== "connected";
      });
      if (disconnectedTarget) {
        setSubmitError("Tous les comptes cibles doivent etre connectes pour un post planifie.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        organizationId: activeOrganizationId,
        title: title.trim(),
        content: content.trim(),
        primaryMediaAssetId: mediaAssetId ?? undefined,
        targetSocialAccountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        scheduledAt: mode === "scheduled" ? new Date(scheduledAt).toISOString() : undefined
      };

      if (post) {
        await updatePost(accessToken, post.id, payload);
      } else {
        await createPost(accessToken, payload);
      }

      onSaved();
      resetState();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : isEditing ? "La mise a jour a echoue." : "La creation a echoue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  return createPortal(
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <form style={dialogStyle} onSubmit={handleSubmit}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{isEditing ? "Edition du post" : "Nouveau post"}</span>
            <h2 id="post-dialog-title">{isEditing ? "Modifier le post" : "Creer un post"}</h2>
          </div>
          <button type="button" className="secondary-button" onClick={handleClose}>
            Fermer
          </button>
        </div>

        <label style={fieldStyle}>
          <span>Titre</span>
          <input
            style={inputStyle}
            type="text"
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>

        <label style={fieldStyle}>
          <span>Contenu</span>
          <textarea
            style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
            maxLength={5000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
        </label>

        <div style={fieldStyle}>
          <span>Mode</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className={mode === "draft" ? "primary-button" : "secondary-button"}
              onClick={() => setMode("draft")}
            >
              Brouillon
            </button>
            <button
              type="button"
              className={mode === "scheduled" ? "primary-button" : "secondary-button"}
              onClick={() => setMode("scheduled")}
            >
              Planifier
            </button>
          </div>
        </div>

        {mode === "scheduled" && (
          <label style={fieldStyle}>
            <span>Date de publication</span>
            <input
              style={inputStyle}
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
            />
          </label>
        )}

        <div style={fieldStyle}>
          <span>Comptes cibles {mode === "draft" && <em style={{ color: "var(--muted)" }}>(optionnel)</em>}</span>
          {isLoadingLists ? (
            <p className="muted">Chargement des comptes…</p>
          ) : accounts.length === 0 ? (
            <p className="muted">
              {mode === "scheduled"
                ? "Aucun compte connecte. Connectez un compte dans Comptes sociaux avant de planifier."
                : "Aucun compte social disponible."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {accounts.map((account) => {
                const selected = selectedAccountIds.includes(account.id);
                const disabled = mode === "scheduled" && account.status !== "connected" && !selected;

                return (
                <label
                  key={account.id}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    opacity: disabled ? 0.55 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleAccount(account.id)}
                    disabled={disabled}
                  />
                  <span>
                    {account.displayName} <em style={{ color: "var(--muted)" }}>({account.provider} · {account.status})</em>
                  </span>
                </label>
              )})}
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <span>Image (optionnelle)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            disabled={uploadStatus === "uploading"}
          />
          {uploadStatus === "uploading" && <p className="muted">Upload en cours…</p>}
          {uploadStatus === "done" && <p className="muted">Image attachee.</p>}
          {uploadStatus === "error" && uploadError && (
            <p style={{ color: "var(--danger)" }}>{uploadError}</p>
          )}
          {existingMedia.length === 0 && uploadStatus !== "done" && !isLoadingLists ? (
            <p className="muted">Aucun media disponible pour cette organisation.</p>
          ) : null}
          {existingMedia.length > 0 && uploadStatus !== "done" && (
            <select
              style={inputStyle}
              value={mediaAssetId ?? ""}
              onChange={(event) => setMediaAssetId(event.target.value || null)}
            >
              <option value="">Ou choisir un media existant…</option>
              {existingMedia.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.storagePath}
                </option>
              ))}
            </select>
          )}
        </div>

        {submitError && (
          <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{submitError}</p>
        )}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary-button" onClick={handleClose}>
            Annuler
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting || uploadStatus === "uploading"}
          >
            {isSubmitting
              ? "Enregistrement…"
              : isEditing
                ? "Enregistrer"
                : mode === "scheduled"
                  ? "Planifier"
                  : "Creer le brouillon"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

const toDateTimeLocalValue = (isoString: string) => {
  const date = new Date(isoString);
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
};
