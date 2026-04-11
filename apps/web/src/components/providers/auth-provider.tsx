"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseClientEnv } from "@/lib/env";

export function LoginCard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Connecte ton projet Supabase pour activer l'authentification reelle.");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !hasSupabaseClientEnv) {
      setMessage("Variables Supabase manquantes. Configure NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Connexion reussie. La session Supabase est disponible dans le navigateur.");
  };

  return (
    <form className="panel login-card" onSubmit={handleSubmit}>
      <div>
        <span className="eyebrow">Connexion</span>
        <h1>Acces operateur</h1>
        <p>Le frontend utilise Supabase Auth, puis transmet le JWT au backend Nest pour la validation tenant-aware.</p>
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
