"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseClientEnv } from "@/lib/env";
import { useSessionContext } from "./session-provider";

export function LoginCard() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { status } = useSessionContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !hasSupabaseClientEnv) {
      setMessage("Configuration Supabase manquante.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Connexion reussie.");
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

      <button className="primary-button" type="submit">
        Se connecter
      </button>

      <p className="muted">{message}</p>
    </form>
  );
}
