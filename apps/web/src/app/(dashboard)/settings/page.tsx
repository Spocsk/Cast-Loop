import { hasSupabaseClientEnv, webEnv } from "@/lib/env";

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Parametres</span>
        <h2>Etat de la stack</h2>
        <p>Page de verification rapide pour le branchement des variables et la separation front/api.</p>
      </header>

      <section className="grid-tiles">
        <article className="panel">
          <span className="eyebrow">Supabase client</span>
          <strong>{hasSupabaseClientEnv ? "Pret" : "A configurer"}</strong>
          <p>{hasSupabaseClientEnv ? webEnv.supabaseUrl : "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY attendus."}</p>
        </article>

        <article className="panel">
          <span className="eyebrow">API Nest</span>
          <strong>{webEnv.apiUrl}</strong>
          <p>Le frontend appelle l'API REST versionnee via cette URL publique.</p>
        </article>
      </section>
    </div>
  );
}
