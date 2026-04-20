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
            className="auth-brand-logo"
            priority
          />
        </div>
        <h1>Connexion</h1>
      </div>
      <LoginCard />
    </main>
  );
}
