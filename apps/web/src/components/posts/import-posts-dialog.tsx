"use client";

import { ImportPostError, ImportPostItemInput } from "@cast-loop/shared";
import Papa from "papaparse";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useSessionContext } from "@/components/providers/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { ImportPostsApiError, importPosts } from "@/lib/api";

interface ImportPostsDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const csvColumns = [
  "title",
  "content",
  "scheduledAt",
  "targetSocialAccountIds",
  "primaryMediaAssetId",
  "sendTelegramReminder"
] as const;

export function ImportPostsDialog({ open, onClose, onImported }: ImportPostsDialogProps) {
  const { accessToken, activeOrganizationId } = useSessionContext();
  const toast = useToast();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [posts, setPosts] = useState<ImportPostItemInput[]>([]);
  const [errors, setErrors] = useState<ImportPostError[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setSelectedFileName(null);
    setPosts([]);
    setErrors([]);
    setStatusMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setSelectedFileName(file.name);
    setPosts([]);
    setErrors([]);
    setStatusMessage(null);

    try {
      const text = await file.text();
      const nextPosts = parseImportFile(file.name, text);
      const nextErrors = validateClientPosts(nextPosts);
      setPosts(nextPosts);
      setErrors(nextErrors);
      setStatusMessage(nextErrors.length > 0 ? null : `${nextPosts.length} post(s) prêt(s) à importer.`);
    } catch (error) {
      setErrors([
        {
          row: 0,
          field: "posts",
          message: error instanceof Error ? error.message : "Impossible de lire ce fichier."
        }
      ]);
    }
  };

  const handleSubmit = async () => {
    if (!accessToken || !activeOrganizationId || posts.length === 0 || errors.length > 0) return;

    setIsSubmitting(true);
    setErrors([]);
    setStatusMessage(null);

    try {
      const result = await importPosts(accessToken, {
        organizationId: activeOrganizationId,
        posts
      });
      toast.success(`${result.createdCount} post(s) importé(s).`);
      reset();
      onImported();
      onClose();
    } catch (error) {
      if (error instanceof ImportPostsApiError && error.errors.length > 0) {
        setErrors(error.errors);
        setStatusMessage(error.message);
      } else {
        const message = error instanceof Error ? error.message : "L'import a échoué.";
        setErrors([{ row: 0, field: "posts", message }]);
      }
      toast.error("Aucun post n'a été importé.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        className="dialog-shell dialog-shell--lg import-posts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-posts-title"
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">Import</span>
            <h2 id="import-posts-title">Importer des posts</h2>
          </div>
          <button type="button" className="secondary-button" onClick={handleClose} disabled={isSubmitting}>
            Fermer
          </button>
        </div>

        <div className="import-posts-layout">
          <label className="import-posts-dropzone">
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.currentTarget.value = "";
              }}
              disabled={isSubmitting}
            />
            <strong>{selectedFileName ?? "Choisir un fichier JSON ou CSV"}</strong>
            <span>Maximum 100 posts. Les cibles doivent être des UUID exacts.</span>
          </label>

          <div className="import-posts-format">
            <strong>Colonnes CSV attendues</strong>
            <code>
              title,content,scheduledAt,targetSocialAccountIds,primaryMediaAssetId,sendTelegramReminder
            </code>
            <p>Les cibles sont séparées par un point-virgule. Une date vide crée un brouillon.</p>
          </div>
        </div>

        {statusMessage ? <p className="form-hint">{statusMessage}</p> : null}

        {errors.length > 0 ? (
          <div className="import-posts-errors" role="alert">
            <strong>Erreurs détectées</strong>
            <ul>
              {errors.map((error, index) => (
                <li key={`${error.row}-${error.field}-${index}`}>
                  <span>{error.row > 0 ? `Ligne ${error.row}` : "Fichier"}</span>
                  <code>{error.field}</code>
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button secondary-button-action"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSubmit}
            disabled={isSubmitting || posts.length === 0 || errors.length > 0}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" label="Import" />
                Import…
              </>
            ) : (
              `Importer ${posts.length > 0 ? posts.length : ""}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function parseImportFile(fileName: string, text: string) {
  if (fileName.toLowerCase().endsWith(".json")) {
    return parseJsonPosts(text);
  }

  if (fileName.toLowerCase().endsWith(".csv")) {
    return parseCsvPosts(text);
  }

  throw new Error("Le fichier doit être au format .json ou .csv.");
}

function parseJsonPosts(text: string) {
  const payload = JSON.parse(text) as { posts?: unknown };

  if (!payload || !Array.isArray(payload.posts)) {
    throw new Error("Le JSON doit contenir un tableau posts.");
  }

  return payload.posts as ImportPostItemInput[];
}

function parseCsvPosts(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "Le CSV est invalide.");
  }

  const fields = parsed.meta.fields ?? [];

  if (fields.length !== csvColumns.length || csvColumns.some((column, index) => fields[index] !== column)) {
    throw new Error("Les colonnes CSV ne correspondent pas au format attendu.");
  }

  return parsed.data.map((row, index) => ({
    title: row.title ?? "",
    content: row.content ?? "",
    scheduledAt: normalizeOptionalCell(row.scheduledAt),
    targetSocialAccountIds: normalizeTargetsCell(row.targetSocialAccountIds),
    primaryMediaAssetId: normalizeOptionalCell(row.primaryMediaAssetId),
    sendTelegramReminder: normalizeBooleanCell(row.sendTelegramReminder, index + 1)
  }));
}

function validateClientPosts(posts: ImportPostItemInput[]) {
  const errors: ImportPostError[] = [];

  if (posts.length === 0) {
    errors.push({ row: 0, field: "posts", message: "Le fichier ne contient aucun post." });
  }

  if (posts.length > 100) {
    errors.push({ row: 0, field: "posts", message: "Le fichier ne peut pas contenir plus de 100 posts." });
  }

  posts.forEach((post, index) => {
    const row = index + 1;

    if (typeof post.title !== "string" || post.title.trim().length === 0) {
      errors.push({ row, field: "title", message: "Ce champ est requis." });
    } else if (post.title.trim().length > 120) {
      errors.push({ row, field: "title", message: "Ce champ ne peut pas dépasser 120 caractères." });
    }

    if (typeof post.content !== "string" || post.content.trim().length === 0) {
      errors.push({ row, field: "content", message: "Ce champ est requis." });
    } else if (post.content.trim().length > 5000) {
      errors.push({ row, field: "content", message: "Ce champ ne peut pas dépasser 5000 caractères." });
    }

    if (post.scheduledAt && Number.isNaN(new Date(post.scheduledAt).getTime())) {
      errors.push({ row, field: "scheduledAt", message: "La date doit être au format ISO 8601." });
    }

    if (post.scheduledAt && (!post.targetSocialAccountIds || post.targetSocialAccountIds.length === 0)) {
      errors.push({
        row,
        field: "targetSocialAccountIds",
        message: "Au moins un compte cible est requis pour planifier un post."
      });
    }

    if (post.sendTelegramReminder !== undefined && typeof post.sendTelegramReminder !== "boolean") {
      errors.push({ row, field: "sendTelegramReminder", message: "La valeur doit être true ou false." });
    }
  });

  return errors;
}

function normalizeOptionalCell(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTargetsCell(value: string | undefined) {
  const targets = (value ?? "")
    .split(";")
    .map((target) => target.trim())
    .filter(Boolean);

  return targets.length > 0 ? targets : undefined;
}

function normalizeBooleanCell(value: string | undefined, row: number) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "") return false;
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  throw new Error(`Ligne ${row}: sendTelegramReminder doit être true, false ou vide.`);
}
