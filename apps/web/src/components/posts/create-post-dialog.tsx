"use client";

import {
  MediaAssetSummary,
  PostSummary,
  SocialAccountSummary,
  SocialProvider
} from "@cast-loop/shared";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionContext } from "@/components/providers/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarIcon, ImageIcon, LinkIcon, UploadIcon } from "@/components/ui/icons";
import { ProviderPill } from "@/components/ui/provider-pill";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import {
  createMediaUploadUrl,
  createPost,
  fetchMediaAssets,
  fetchMediaAssetViewUrl,
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
type FieldName = "title" | "content" | "scheduledAt" | "targetSocialAccountIds" | "sendTelegramReminder";
type LocalDraftPayload = {
  title: string;
  content: string;
  mode: Mode;
  scheduledAt: string;
  selectedAccountIds: string[];
  mediaAssetId: string | null;
  sendTelegramReminder: boolean;
  updatedAt: string;
};

export function CreatePostDialog({ open, post, onClose, onSaved }: CreatePostDialogProps) {
  const { accessToken, activeOrganizationId } = useSessionContext();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<Mode>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [sendTelegramReminder, setSendTelegramReminder] = useState(false);
  const [accounts, setAccounts] = useState<SocialAccountSummary[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaAssetSummary[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({});
  const [dragging, setDragging] = useState(false);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasInitializedLocalDraft, setHasInitializedLocalDraft] = useState(false);
  const [hasRestoredLocalDraft, setHasRestoredLocalDraft] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const isEditing = Boolean(post);
  const localDraftKey = activeOrganizationId ? buildLocalDraftStorageKey(activeOrganizationId) : null;

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

  useEffect(
    () => () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    },
    []
  );

  const resetPreview = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setMediaPreviewUrl(null);
  };

  const resetState = () => {
    setTitle("");
    setContent("");
    setMode("draft");
    setScheduledAt("");
    setSelectedAccountIds([]);
    setMediaAssetId(null);
    setSendTelegramReminder(false);
    setUploadStatus("idle");
    setUploadError(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setFieldErrors({});
    setTouchedFields({});
    setDragging(false);
    resetPreview();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!open) {
      setHasInitializedLocalDraft(false);
      return;
    }

    setConfirmDiscardOpen(false);

    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setMode(post.scheduledAt ? "scheduled" : "draft");
      setScheduledAt(post.scheduledAt ? toDateTimeLocalValue(post.scheduledAt) : "");
      setSelectedAccountIds(post.targetSocialAccountIds);
      setMediaAssetId(post.primaryMediaAssetId ?? null);
      setSendTelegramReminder(post.sendTelegramReminder);
      setHasRestoredLocalDraft(false);
    } else {
      const localDraft = localDraftKey ? readLocalDraft(localDraftKey) : null;

      if (localDraft) {
        setTitle(localDraft.title);
        setContent(localDraft.content);
        setMode(localDraft.mode);
        setScheduledAt(localDraft.scheduledAt);
        setSelectedAccountIds(localDraft.selectedAccountIds);
        setMediaAssetId(localDraft.mediaAssetId);
        setSendTelegramReminder(localDraft.sendTelegramReminder);
        setHasRestoredLocalDraft(true);
      } else {
        resetState();
        setHasRestoredLocalDraft(false);
      }
    }

    setHasInitializedLocalDraft(true);
    setUploadStatus("idle");
    setUploadError(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setFieldErrors({});
    setTouchedFields({});
    setDragging(false);
    resetPreview();
  }, [localDraftKey, open, post]);

  const closeDialog = () => {
    uploadAbortRef.current?.abort();
    resetState();
    setHasInitializedLocalDraft(false);
    setHasRestoredLocalDraft(false);
    setConfirmDiscardOpen(false);
    onClose();
  };

  const clearLocalDraft = () => {
    if (localDraftKey) {
      window.localStorage.removeItem(localDraftKey);
    }
  };

  const handleCloseRequest = () => {
    if (!open) {
      return;
    }

    if (!isEditing && hasMeaningfulDraft({ title, content, mode, scheduledAt, selectedAccountIds, mediaAssetId, sendTelegramReminder })) {
      setConfirmDiscardOpen(true);
      return;
    }

    closeDialog();
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

  useEffect(() => {
    if (!mediaAssetId || !accessToken || !activeOrganizationId || previewObjectUrlRef.current) {
      if (!mediaAssetId && !previewObjectUrlRef.current) {
        setMediaPreviewUrl(null);
      }
      return;
    }

    let active = true;

    void fetchMediaAssetViewUrl(accessToken, activeOrganizationId, mediaAssetId)
      .then((result) => {
        if (!active) return;
        setMediaPreviewUrl(result.signedUrl);
      })
      .catch(() => {
        if (!active) return;
        setMediaPreviewUrl(null);
      });

    return () => {
      active = false;
    };
  }, [accessToken, activeOrganizationId, mediaAssetId]);

  useEffect(() => {
    if (!open || isEditing || !localDraftKey || !hasInitializedLocalDraft) {
      return;
    }

    const localDraft = buildLocalDraftPayload({
      title,
      content,
      mode,
      scheduledAt,
      selectedAccountIds,
      mediaAssetId,
      sendTelegramReminder
    });

    if (!localDraft) {
      window.localStorage.removeItem(localDraftKey);
      return;
    }

    window.localStorage.setItem(localDraftKey, JSON.stringify(localDraft));
  }, [
    content,
    hasInitializedLocalDraft,
    isEditing,
    localDraftKey,
    mediaAssetId,
    mode,
    open,
    scheduledAt,
    selectedAccountIds,
    sendTelegramReminder,
    title
  ]);

  useEffect(() => {
    if (!open || isEditing || isLoadingLists) {
      return;
    }

    const validSelectedAccountIds = selectedAccountIds.filter((accountId) =>
      accounts.some((account) => account.id === accountId)
    );

    if (validSelectedAccountIds.length !== selectedAccountIds.length) {
      setSelectedAccountIds(validSelectedAccountIds);
    }
  }, [accounts, isEditing, isLoadingLists, open, selectedAccountIds]);

  useEffect(() => {
    if (!open || isEditing || isLoadingLists || !mediaAssetId) {
      return;
    }

    const hasMedia = existingMedia.some((asset) => asset.id === mediaAssetId);

    if (!hasMedia) {
      setMediaAssetId(null);
    }
  }, [existingMedia, isEditing, isLoadingLists, mediaAssetId, open]);

  const selectedAccounts = accounts.filter((account) => selectedAccountIds.includes(account.id));
  const selectedConnectOnlyAccounts = selectedAccounts.filter(
    (account) => account.publishCapability === "connect_only"
  );
  const hasSelectedConnectOnlyAccounts = selectedConnectOnlyAccounts.length > 0;
  const publishableAccounts = accounts.filter((account) => account.publishCapability === "publishable");
  const distinctPreviewProviders = Array.from(
    new Set(selectedAccounts.map((account) => account.provider))
  ) as SocialProvider[];

  useEffect(() => {
    if (!hasSelectedConnectOnlyAccounts && sendTelegramReminder) {
      setSendTelegramReminder(false);
    }
  }, [hasSelectedConnectOnlyAccounts, sendTelegramReminder]);

  if (!open || !mounted) {
    return null;
  }

  const validateField = (
    field: FieldName,
    snapshot?: {
      title?: string;
      content?: string;
      mode?: Mode;
      scheduledAt?: string;
      selectedAccountIds?: string[];
      sendTelegramReminder?: boolean;
    }
  ) => {
    const nextTitle = snapshot?.title ?? title;
    const nextContent = snapshot?.content ?? content;
    const nextMode = snapshot?.mode ?? mode;
    const nextScheduledAt = snapshot?.scheduledAt ?? scheduledAt;
    const nextAccountIds = snapshot?.selectedAccountIds ?? selectedAccountIds;
    const nextReminder = snapshot?.sendTelegramReminder ?? sendTelegramReminder;
    const nextSelectedAccounts = accounts.filter((account) => nextAccountIds.includes(account.id));
    const nextConnectOnlyAccounts = nextSelectedAccounts.filter(
      (account) => account.publishCapability === "connect_only"
    );

    switch (field) {
      case "title":
        return nextTitle.trim().length === 0 ? "Le titre est requis." : undefined;
      case "content":
        return nextContent.trim().length === 0 ? "Le contenu est requis." : undefined;
      case "scheduledAt":
        if (nextMode !== "scheduled") return undefined;
        return nextScheduledAt ? undefined : "Choisis une date et une heure de publication.";
      case "targetSocialAccountIds":
        if (nextMode !== "scheduled") return undefined;
        if (nextAccountIds.length === 0) {
          return "Sélectionne au moins un compte connecté pour planifier.";
        }
        if (
          nextAccountIds.some((accountId) => {
            const account = accounts.find((item) => item.id === accountId);
            return account?.status !== "connected";
          })
        ) {
          return "Tous les comptes ciblés doivent être connectés pour un post planifié.";
        }
        return undefined;
      case "sendTelegramReminder":
        if (nextMode !== "scheduled" || nextConnectOnlyAccounts.length === 0) return undefined;
        return nextReminder
          ? undefined
          : "Active le rappel Telegram pour planifier avec des comptes en connexion seule.";
      default:
        return undefined;
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    for (const field of ["title", "content", "scheduledAt", "targetSocialAccountIds", "sendTelegramReminder"] as FieldName[]) {
      const error = validateField(field);
      if (error) {
        nextErrors[field] = error;
      }
    }
    setFieldErrors(nextErrors);
    return nextErrors;
  };

  const touchField = (field: FieldName, nextError?: string) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
    setFieldErrors((current) => ({
      ...current,
      [field]: nextError ?? validateField(field)
    }));
  };

  const handleFile = async (file: File) => {
    if (!accessToken || !activeOrganizationId) return;

    setUploadError(null);
    setUploadStatus("uploading");
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = new AbortController();

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    previewObjectUrlRef.current = URL.createObjectURL(file);
    setMediaPreviewUrl(previewObjectUrlRef.current);

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
      setExistingMedia(await fetchMediaAssets(accessToken, activeOrganizationId));
      toast.success("L'image a été ajoutée au post.");
    } catch (error) {
      setUploadStatus("error");
      const message = error instanceof Error ? error.message : "Échec de l'upload";
      setUploadError(message);
      toast.error(message);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !activeOrganizationId) return;

    setSubmitError(null);
    const nextErrors = validateForm();
    setTouchedFields({
      title: true,
      content: true,
      scheduledAt: true,
      targetSocialAccountIds: true,
      sendTelegramReminder: true
    });

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("Corrige les champs signalés avant de continuer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        organizationId: activeOrganizationId,
        title: title.trim(),
        content: content.trim(),
        primaryMediaAssetId: mediaAssetId ?? undefined,
        targetSocialAccountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        scheduledAt: mode === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
        sendTelegramReminder
      };

      if (post) {
        await updatePost(accessToken, post.id, payload);
        toast.success("Le post a été mis à jour.");
      } else {
        await createPost(accessToken, payload);
        clearLocalDraft();
        toast.success(mode === "scheduled" ? "Le post a été planifié." : "Le brouillon a été créé.");
      }

      onSaved();
      resetState();
      setHasRestoredLocalDraft(false);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isEditing
            ? "La mise à jour a échoué."
            : "La création a échoué.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAccount = (id: string) => {
    const nextValue = selectedAccountIds.includes(id)
      ? selectedAccountIds.filter((value) => value !== id)
      : [...selectedAccountIds, id];

    setSelectedAccountIds(nextValue);

    if (touchedFields.targetSocialAccountIds) {
      setFieldErrors((current) => ({
        ...current,
        targetSocialAccountIds: validateField("targetSocialAccountIds", { selectedAccountIds: nextValue }),
        sendTelegramReminder: validateField("sendTelegramReminder", {
          selectedAccountIds: nextValue
        })
      }));
    }
  };

  const removeMedia = () => {
    setMediaAssetId(null);
    setUploadStatus("idle");
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    resetPreview();
  };

  return createPortal(
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleCloseRequest();
      }}
    >
      <form className="dialog-shell dialog-shell--xl create-post-dialog" onSubmit={handleSubmit}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{isEditing ? "Édition du post" : "Nouveau post"}</span>
            <h2 id="post-dialog-title">{isEditing ? "Modifier le post" : "Créer un post"}</h2>
          </div>
          <button type="button" className="secondary-button secondary-button-action" onClick={handleCloseRequest}>
            Fermer
          </button>
        </div>

        <div className="create-post-layout">
          <div className="create-post-main">
            <label className="form-field">
              <span className="form-label-required">Titre</span>
              {hasRestoredLocalDraft && !isEditing ? (
                <span className="form-hint">Brouillon local restauré automatiquement.</span>
              ) : null}
              <input
                className="form-input"
                type="text"
                maxLength={120}
                value={title}
                aria-invalid={Boolean(touchedFields.title && fieldErrors.title)}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => touchField("title")}
              />
              {touchedFields.title && fieldErrors.title ? <span className="form-field-error">{fieldErrors.title}</span> : null}
            </label>

            <label className="form-field">
              <span className="form-label-required">Contenu</span>
              <textarea
                className="form-input form-textarea"
                maxLength={5000}
                value={content}
                aria-invalid={Boolean(touchedFields.content && fieldErrors.content)}
                onChange={(event) => setContent(event.target.value)}
                onBlur={() => touchField("content")}
              />
              {touchedFields.content && fieldErrors.content ? <span className="form-field-error">{fieldErrors.content}</span> : null}
            </label>

            <div className="form-field">
              <span>Mode de publication</span>
              <div className="segmented" role="tablist" aria-label="Choisir un mode de publication">
                <button
                  type="button"
                  className="segmented-option"
                  aria-selected={mode === "draft"}
                  onClick={() => {
                    setMode("draft");
                    setFieldErrors((current) => ({
                      ...current,
                      scheduledAt: undefined,
                      targetSocialAccountIds: undefined,
                      sendTelegramReminder: undefined
                    }));
                  }}
                >
                  Brouillon
                </button>
                <button
                  type="button"
                  className="segmented-option"
                  aria-selected={mode === "scheduled"}
                  onClick={() => setMode("scheduled")}
                >
                  Planifier
                </button>
              </div>
              <p className="segmented-helper">
                {mode === "draft"
                  ? "Enregistre l'idée sans publication immédiate."
                  : "Publication automatique à la date choisie sur les comptes sélectionnés."}
              </p>
            </div>

            {mode === "scheduled" ? (
              <div className="form-field">
                <span className="form-label-required">Date de publication</span>
                <DateTimePicker
                  value={scheduledAt}
                  onChange={(nextValue) => {
                    setScheduledAt(nextValue);
                    if (touchedFields.scheduledAt) {
                      setFieldErrors((current) => ({
                        ...current,
                        scheduledAt: validateField("scheduledAt", { scheduledAt: nextValue })
                      }));
                    }
                  }}
                  label="Choisir une date et une heure de publication"
                  invalid={Boolean(touchedFields.scheduledAt && fieldErrors.scheduledAt)}
                />
                {touchedFields.scheduledAt && fieldErrors.scheduledAt ? (
                  <span className="form-field-error">{fieldErrors.scheduledAt}</span>
                ) : null}
              </div>
            ) : null}

            <div className="form-field">
              <span className={mode === "scheduled" ? "form-label-required" : undefined}>Comptes cibles</span>
              {isLoadingLists ? (
                <p className="muted">
                  <Spinner size="sm" label="Chargement des comptes" /> Chargement des comptes…
                </p>
              ) : accounts.length === 0 ? (
                <EmptyState
                  icon={<LinkIcon />}
                  title="Aucun compte social disponible"
                  description={
                    mode === "scheduled"
                      ? "Connecte un compte dans Comptes sociaux avant de planifier une publication."
                      : "Les comptes sociaux connectés apparaîtront ici pour cibler tes publications."
                  }
                />
              ) : (
                <div className="form-check-group">
                  {accounts.map((account) => {
                    const selected = selectedAccountIds.includes(account.id);
                    const disabled = mode === "scheduled" && account.status !== "connected" && !selected;

                    return (
                      <label
                        key={account.id}
                        className="form-check"
                        style={{ opacity: disabled ? 0.55 : 1 }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleAccount(account.id)}
                          disabled={disabled}
                          onBlur={() => touchField("targetSocialAccountIds")}
                        />
                        <span>
                          {account.displayName}{" "}
                          <em className="muted">
                            ({account.provider} · {accountLabel(account.accountType)} ·{" "}
                            {account.publishCapability === "publishable" ? "Publie" : "Connexion seule"} · {account.status})
                          </em>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {touchedFields.targetSocialAccountIds && fieldErrors.targetSocialAccountIds ? (
                <span className="form-field-error">{fieldErrors.targetSocialAccountIds}</span>
              ) : null}
              {accounts.length > 0 && publishableAccounts.length === 0 ? (
                <p className="form-hint">
                  Aucun compte publiable. Les comptes sélectionnés resteront visibles mais devront passer par un rappel Telegram.
                </p>
              ) : null}
            </div>

            {mode === "scheduled" && hasSelectedConnectOnlyAccounts ? (
              <div className="form-field">
                <span className="form-label-required">Rappel manuel</span>
                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={sendTelegramReminder}
                    onChange={(event) => {
                      setSendTelegramReminder(event.target.checked);
                      if (touchedFields.sendTelegramReminder) {
                        setFieldErrors((current) => ({
                          ...current,
                          sendTelegramReminder: validateField("sendTelegramReminder", {
                            sendTelegramReminder: event.target.checked
                          })
                        }));
                      }
                    }}
                    onBlur={() => touchField("sendTelegramReminder")}
                  />
                  <span>Envoyer un rappel Telegram à l'heure planifiée</span>
                </label>
                <p className="form-hint">
                  Les comptes en connexion seule resteront visibles dans le post, mais Cast Loop vous rappellera de publier manuellement via Telegram.
                </p>
                {touchedFields.sendTelegramReminder && fieldErrors.sendTelegramReminder ? (
                  <span className="form-field-error">{fieldErrors.sendTelegramReminder}</span>
                ) : null}
              </div>
            ) : null}

            <div className="form-field">
              <span>Image</span>
              <label
                className="dropzone"
                data-dragging={dragging}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => void handleDrop(event)}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFile(file);
                    }
                  }}
                  disabled={uploadStatus === "uploading"}
                />
                <span className="dropzone-icon" aria-hidden="true">
                  <UploadIcon />
                </span>
                <span className="dropzone-hint">
                  <strong>Dépose une image ou clique pour en choisir une</strong>
                  <span>PNG, JPG ou WebP · une image par post</span>
                </span>
              </label>

              {mediaPreviewUrl ? (
                <div className="dropzone-preview">
                  <img src={mediaPreviewUrl} alt="Aperçu du média sélectionné" />
                  <div className="dropzone-preview-meta">
                    <strong>{selectedMediaLabel(existingMedia, mediaAssetId) ?? "Image sélectionnée"}</strong>
                    <span>
                      {uploadStatus === "uploading"
                        ? "Upload en cours…"
                        : uploadStatus === "done"
                          ? "Image attachée au post"
                          : "Image prête pour la prévisualisation"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button secondary-button-action"
                    onClick={removeMedia}
                  >
                    Retirer
                  </button>
                </div>
              ) : null}

              {uploadError ? <span className="form-field-error">{uploadError}</span> : null}

              {existingMedia.length > 0 ? (
                <Dropdown
                  options={existingMedia.map((asset) => ({
                    value: asset.id,
                    label: asset.storagePath.split("/").at(-1) ?? asset.storagePath,
                    hint: `${asset.mimeType} · ${formatFileSize(asset.fileSizeBytes)}`
                  }))}
                  value={mediaAssetId}
                  onChange={(nextValue) => {
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                    if (previewObjectUrlRef.current) {
                      URL.revokeObjectURL(previewObjectUrlRef.current);
                      previewObjectUrlRef.current = null;
                    }
                    setUploadStatus("idle");
                    setMediaAssetId(nextValue);
                  }}
                  label="Choisir un média existant"
                  placeholder="Ou sélectionner un média existant"
                />
              ) : null}

              {!mediaPreviewUrl && existingMedia.length === 0 && !isLoadingLists ? (
                <EmptyState
                  icon={<ImageIcon />}
                  title="Aucun média disponible"
                  description="Ajoute un premier visuel pour enrichir le post et alimenter la bibliothèque."
                />
              ) : null}
            </div>

            {submitError ? <p className="form-hint-error">{submitError}</p> : null}

            <div className="dialog-actions">
              <button type="button" className="secondary-button secondary-button-action" onClick={handleCloseRequest}>
                Annuler
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting || uploadStatus === "uploading"}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" label="Enregistrement" />
                    Enregistrement…
                  </>
                ) : isEditing ? (
                  "Enregistrer"
                ) : mode === "scheduled" ? (
                  "Planifier"
                ) : (
                  "Créer le brouillon"
                )}
              </button>
            </div>
          </div>

          <aside className="create-post-sidebar">
            <div className="create-post-preview">
              <div className="create-post-preview-head">
                <span className="eyebrow">Aperçu</span>
                <div className="provider-stack">
                  {distinctPreviewProviders.length > 0 ? (
                    distinctPreviewProviders.map((provider) => (
                      <ProviderPill key={provider} provider={provider} />
                    ))
                  ) : (
                    <ProviderPill provider="linkedin" />
                  )}
                </div>
              </div>

              <div className="create-post-preview-card">
                <div className="create-post-preview-meta">
                  <strong>{title.trim() || "Titre du post"}</strong>
                  <span>
                    {mode === "scheduled" && scheduledAt
                      ? `Publication prévue le ${formatPreviewDate(scheduledAt)}`
                      : "Brouillon non planifié"}
                  </span>
                </div>

                {mediaPreviewUrl ? (
                  <img
                    src={mediaPreviewUrl}
                    alt="Aperçu du visuel du post"
                    className="create-post-preview-image"
                  />
                ) : null}

                <p className="create-post-preview-copy">
                  {content.trim() || "Le texte du post apparaîtra ici pour vérifier le ton, la longueur et la hiérarchie du contenu avant publication."}
                </p>

                {hasSelectedConnectOnlyAccounts ? (
                  <div className="create-post-preview-note">
                    <CalendarIcon />
                    <span>
                      {sendTelegramReminder
                        ? "Un rappel Telegram sera envoyé pour les comptes en connexion seule."
                        : "Les comptes en connexion seule nécessitent un rappel Telegram."}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </form>
      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Supprimer le brouillon local ?"
        description="Le contenu saisi pour ce nouveau post sera perdu sur cet appareil."
        confirmLabel="Abandonner"
        cancelLabel="Continuer l’édition"
        tone="danger"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          clearLocalDraft();
          closeDialog();
        }}
      />
    </div>,
    document.body
  );
}

const buildLocalDraftStorageKey = (organizationId: string) => `cast-loop:create-post-draft:${organizationId}`;

const buildLocalDraftPayload = (draft: Omit<LocalDraftPayload, "updatedAt">): LocalDraftPayload | null => {
  if (!hasMeaningfulDraft(draft)) {
    return null;
  }

  return {
    ...draft,
    updatedAt: new Date().toISOString()
  };
};

const readLocalDraft = (storageKey: string): LocalDraftPayload | null => {
  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalDraftPayload>;

    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      content: typeof parsed.content === "string" ? parsed.content : "",
      mode: parsed.mode === "scheduled" ? "scheduled" : "draft",
      scheduledAt: typeof parsed.scheduledAt === "string" ? parsed.scheduledAt : "",
      selectedAccountIds: Array.isArray(parsed.selectedAccountIds)
        ? parsed.selectedAccountIds.filter((value): value is string => typeof value === "string")
        : [],
      mediaAssetId: typeof parsed.mediaAssetId === "string" ? parsed.mediaAssetId : null,
      sendTelegramReminder: Boolean(parsed.sendTelegramReminder),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
};

const hasMeaningfulDraft = ({
  title,
  content,
  mode,
  scheduledAt,
  selectedAccountIds,
  mediaAssetId,
  sendTelegramReminder
}: Pick<
  LocalDraftPayload,
  "title" | "content" | "mode" | "scheduledAt" | "selectedAccountIds" | "mediaAssetId" | "sendTelegramReminder"
>) =>
  title.trim().length > 0 ||
  content.trim().length > 0 ||
  mode === "scheduled" ||
  scheduledAt.length > 0 ||
  selectedAccountIds.length > 0 ||
  mediaAssetId !== null ||
  sendTelegramReminder;

const toDateTimeLocalValue = (isoString: string) => {
  const date = new Date(isoString);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-") + `T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const accountLabel = (accountType: SocialAccountSummary["accountType"]) => {
  switch (accountType) {
    case "personal":
      return "Profil perso";
    case "page":
      return "Page";
    case "business":
      return "Business";
    case "creator":
      return "Creator";
    default:
      return accountType;
  }
};

const selectedMediaLabel = (existingMedia: MediaAssetSummary[], mediaAssetId: string | null) => {
  if (!mediaAssetId) return null;
  const asset = existingMedia.find((item) => item.id === mediaAssetId);
  return asset?.storagePath.split("/").at(-1) ?? null;
};

const formatPreviewDate = (scheduledAt: string) =>
  new Date(scheduledAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const formatFileSize = (fileSizeBytes: number) => {
  if (fileSizeBytes < 1024) return `${fileSizeBytes} B`;
  if (fileSizeBytes < 1024 * 1024) return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};
