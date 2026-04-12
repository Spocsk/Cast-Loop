import { ProviderPill } from "@/components/ui/provider-pill";
import { socialAccounts } from "@/lib/mock-data";

export default function SocialAccountsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <span className="eyebrow">Comptes sociaux</span>
        <h2>Connexions business actives et a renouveler</h2>
        <p>La v1 cible Facebook Pages, Instagram Business et LinkedIn Pages, avec expiration de token suivie en base.</p>
      </header>

      {/* FIX: table-row attend 4 colonnes en CSS, ajout d'une 4e colonne (action placeholder) */}
      <div className="table-list panel">
        {socialAccounts.map((account) => (
          <article key={account.id} className="table-row">
            <div>
              <ProviderPill provider={account.provider} />
              <strong>{account.displayName}</strong>
              <p>{account.handle}</p>
            </div>
            <div>
              <span className={`status status-${account.status}`}>{account.status}</span>
            </div>
            <div>
              <p className="muted">Expiration</p>
            </div>
            <div>
              <strong>{account.tokenExpiresAt ? new Date(account.tokenExpiresAt).toLocaleString("fr-FR") : "Aucun"}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
