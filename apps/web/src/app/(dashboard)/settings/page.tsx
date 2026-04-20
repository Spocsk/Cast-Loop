"use client";

import { useState } from "react";
import { useSessionContext } from "@/components/providers/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useToast } from "@/components/ui/toast-provider";
import { sendTelegramTestMessage } from "@/lib/api";
import { hasSupabaseClientEnv, webEnv } from "@/lib/env";

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export default function SettingsPage() {
  const { accessToken, activeOrganization, activeOrganizationId } = useSessionContext();
  const toast = useToast();
  const [isSendingTelegramTest, setIsSendingTelegramTest] = useState(false);
  const [lastTelegramTestSentAt, setLastTelegramTestSentAt] = useState<string | null>(null);

  const handleSendTelegramTest = async () => {
    if (!accessToken || !activeOrganizationId) {
      toast.error("Aucune entreprise active n'est disponible pour ce test.");
      return;
    }

    setIsSendingTelegramTest(true);

    try {
      const result = await sendTelegramTestMessage(accessToken, {
        organizationId: activeOrganizationId
      });

      setLastTelegramTestSentAt(result.sentAt);
      toast.success("Le message test a été envoyé sur le canal Telegram configure.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer le message test Telegram.");
    } finally {
      setIsSendingTelegramTest(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Paramètres</span>
        <h2>Configuration</h2>
        <p className="page-scope">
          Entreprise active : <strong>{activeOrganization?.name ?? "Aucune"}</strong>
        </p>
      </header>

      <section className="grid-tiles">
        <article className="panel">
          <span className="eyebrow">Supabase client</span>
          <strong>{hasSupabaseClientEnv ? "Prêt" : "À configurer"}</strong>
          <p>
            {hasSupabaseClientEnv
              ? webEnv.supabaseUrl
              : "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY attendus."}
          </p>
        </article>

        <article className="panel">
          <span className="eyebrow">API Nest</span>
          <strong>{webEnv.apiUrl}</strong>
          <p className="muted">URL publique de l'API</p>
        </article>

        <article className="panel social-provider-panel">
          <div>
            <span className="eyebrow">Telegram</span>
            <strong>Canal de notification</strong>
            <p>
              Envoie un message de verification vers le bot Telegram configure sur le serveur pour confirmer
              que le canal de rappel est bien operationnel.
            </p>
            <p className="page-scope">
              Entreprise concernee : <strong>{activeOrganization?.name ?? "Aucune entreprise active"}</strong>
            </p>
          </div>

          <div>
            <button
              type="button"
              className="primary-button"
              onClick={handleSendTelegramTest}
              disabled={!accessToken || !activeOrganizationId || isSendingTelegramTest}
            >
              {isSendingTelegramTest ? (
                <>
                  <Spinner size="sm" className="button-spinner" />
                  Envoi en cours...
                </>
              ) : (
                "Envoyer un message test"
              )}
            </button>
          </div>

          {!activeOrganizationId ? (
            <p className="social-feedback social-feedback-warning">
              Selectionne une entreprise active pour lancer le test Telegram.
            </p>
          ) : null}

          {lastTelegramTestSentAt ? (
            <p className="social-feedback social-feedback-success">
              Dernier message test envoye le {formatTimestamp(lastTelegramTestSentAt)}.
            </p>
          ) : null}
        </article>

        <article className="panel">
          <ThemeSwitcher />
        </article>
      </section>
    </div>
  );
}
