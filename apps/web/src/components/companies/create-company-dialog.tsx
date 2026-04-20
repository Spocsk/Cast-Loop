"use client";

import { CreateOrganizationResult } from "@cast-loop/shared";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionContext } from "@/components/providers/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { createOrganization } from "@/lib/api";

interface CreateCompanyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (organization: CreateOrganizationResult) => Promise<void> | void;
}

export function CreateCompanyDialog({ open, onClose, onCreated }: CreateCompanyDialogProps) {
  const { accessToken } = useSessionContext();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setName("");
      setSubmitError(null);
      setIsSubmitting(false);
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    setName("");
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setSubmitError("Le nom de l'entreprise est requis.");
      return;
    }

    if (trimmedName.length > 120) {
      setSubmitError("Le nom de l'entreprise doit contenir au maximum 120 caractères.");
      return;
    }

    if (!accessToken) {
      setSubmitError("Session invalide. Reconnecte-toi pour continuer.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const organization = await createOrganization(accessToken, { name: trimmedName });
      await onCreated(organization);
      setName("");
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Impossible de créer l'entreprise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="create-company-dialog-title">
      <form className="dialog-shell dialog-shell--sm" onSubmit={handleSubmit}>
        <header className="page-header">
          <div>
            <span className="eyebrow">Nouvelle entreprise</span>
            <h2 id="create-company-dialog-title">Créer une entreprise</h2>
          </div>
          <p className="muted">Le slug sera généré automatiquement à partir du nom fourni.</p>
        </header>

        <label className="form-field">
          <span>Nom de l'entreprise</span>
          <input
            className="form-input"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Cast Loop Studio"
            autoFocus
            disabled={isSubmitting}
          />
        </label>

        {submitError ? <p className="form-hint-error">{submitError}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="secondary-button secondary-button-action" onClick={handleClose} disabled={isSubmitting}>
            Annuler
          </button>
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label="Création en cours" /> : null}
            {isSubmitting ? "Création…" : "Créer"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
