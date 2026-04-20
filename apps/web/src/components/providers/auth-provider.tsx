"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseClientEnv } from "@/lib/env";
import { useSessionContext } from "./session-provider";
import { Spinner } from "../ui/spinner";
import { useToast } from "../ui/toast-provider";

export function LoginCard() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { status, error: sessionError } = useSessionContext();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSuccess, setPendingSuccess] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && pendingSuccess) {
      toast.success("Connexion reussie.");
      setPendingSuccess(false);
      router.replace("/dashboard");
      return;
    }

    if (status === "unauthenticated" && pendingSuccess && sessionError) {
      toast.error(sessionError);
      setMessage(sessionError);
      setPendingSuccess(false);
      return;
    }

    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [pendingSuccess, router, sessionError, status, toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !hasSupabaseClientEnv) {
      const nextMessage = "Configuration Supabase manquante.";
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage(error.message);
        toast.error(error.message);
        return;
      }

      setPendingSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="panel login-card" onSubmit={handleSubmit}>
      <div>
        <span className="eyebrow">Connexion</span>
        <h1>Se connecter</h1>
      </div>

      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@cast-loop.app" type="email" />
      </label>

      <label>
        Mot de passe
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type="password" />
      </label>

      <button className="primary-button" type="submit" disabled={isSubmitting || status === "loading"}>
        {isSubmitting ? <Spinner size="sm" label="Connexion en cours" /> : null}
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </button>

      <p className="muted">{message}</p>
    </form>
  );
}
