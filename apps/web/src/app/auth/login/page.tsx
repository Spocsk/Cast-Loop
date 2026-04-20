import Image from "next/image";
import { LoginCard } from "@/components/providers/auth-provider";

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <div className="auth-copy">
        <div className="auth-brand">
          <Image
            src="/assets/cast-loop-logo.png"
            alt="Logo Cast Loop"
            width={768}
            height={768}
            className="auth-brand-logo auth-brand-logo-light"
            priority
          />
          <Image
            src="/assets/cast-loop-logo-white.png"
            alt="Logo Cast Loop"
            width={768}
            height={768}
            className="auth-brand-logo auth-brand-logo-dark"
            priority
          />
        </div>
        <h1>Connexion</h1>
      </div>
      <LoginCard />
    </main>
  );
}
