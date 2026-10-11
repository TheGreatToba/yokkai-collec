import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { PasswordUpdateForm } from "@/components/password-reset-forms";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: "Nouveau mot de passe · Yokkai Collec’"
};
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <div className="yk-auth-shell">
      <header className="yk-auth-header">
        <Link
          href="/"
          className="yk-auth-brand"
          aria-label="Yokkai Collec’, accueil"
        >
          <span className="yk-auth-logo">Y</span>
          <span>
            Yokkai
            <br />
            Collec’
          </span>
        </Link>
        <Link href="/connexion" className="yk-auth-return">
          <span aria-hidden="true">←</span> Connexion
        </Link>
      </header>
      <main className="yk-auth-main">
        <section className="yk-auth-panel">
          <p className="eyebrow">Protège ta collection</p>
          <h1 className="yk-auth-title">Choisis un nouveau mot de passe</h1>
          <p className="yk-auth-intro">
            Utilise un mot de passe unique que tu n’emploies sur aucun autre
            site.
          </p>
          {user ? (
            <PasswordUpdateForm />
          ) : (
            <div className="yk-auth-success">
              <p role="alert" className="auth-error">
                Ce lien de réinitialisation est invalide ou a expiré.
              </p>
              <Link href="/mot-de-passe-oublie" className="yk-auth-link">
                Demander un nouveau lien →
              </Link>
            </div>
          )}
        </section>
      </main>
      <footer className="yk-auth-footer">
        Yokkai Collec’ · À chaque carte, une découverte.
      </footer>
    </div>
  );
}
