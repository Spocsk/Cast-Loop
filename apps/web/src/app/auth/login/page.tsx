import { LoginCard } from "@/components/providers/auth-provider";

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <div className="auth-copy">
        <span className="eyebrow">Cast Loop</span>
        <h1>Connexion operateur</h1>
        <p>Connecte Supabase Auth pour acceder au dashboard, puis laisse Nest valider les sessions et les droits tenant.</p>
      </div>
      <LoginCard />
    </main>
  );
}
