import { LoginCard } from "@/components/providers/auth-provider";

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <div className="auth-copy">
        <span className="eyebrow">Cast Loop</span>
        <h1>Connexion</h1>
      </div>
      <LoginCard />
    </main>
  );
}
