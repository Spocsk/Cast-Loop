"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastRecord {
  id: number;
  tone: ToastTone;
  message: string;
  durationMs: number;
}

interface ToastOptions {
  durationMs?: number;
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

const TOAST_DURATION_MS = 4200;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const push = (tone: ToastTone, message: string, options?: ToastOptions) => {
    const record: ToastRecord = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      tone,
      message,
      durationMs: options?.durationMs ?? TOAST_DURATION_MS
    };

    setToasts((current) => [...current, record]);
  };

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      warning: (message, options) => push("warning", message, options),
      info: (message, options) => push("info", message, options)
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
};

function ToastItem({
  toast,
  onDismiss
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [onDismiss, toast.durationMs, toast.id]);

  return (
    <article className={`toast toast-${toast.tone}`} role="status">
      <div className="toast-copy">
        <strong>{toastLabel(toast.tone)}</strong>
        <p>{toast.message}</p>
      </div>

      <button
        type="button"
        className="toast-close"
        aria-label="Fermer la notification"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </article>
  );
}

const toastLabel = (tone: ToastTone) => {
  switch (tone) {
    case "success":
      return "Succes";
    case "error":
      return "Erreur";
    case "warning":
      return "Attention";
    case "info":
    default:
      return "Information";
  }
};
