import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { PasswordUpdateForm } from "@/components/password-reset-forms";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: "New password · Yokkai Collec’"
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
          aria-label="Yokkai Collec’, home"
        >
          <span className="yk-auth-logo">Y</span>
          <span>
            Yokkai
            <br />
            Collec’
          </span>
        </Link>
        <Link href="/connexion" className="yk-auth-return">
          <span aria-hidden="true">←</span> Sign in
        </Link>
      </header>
      <main className="yk-auth-main">
        <section className="yk-auth-panel">
          <p className="eyebrow">Keep your collection safe</p>
          <h1 className="yk-auth-title">Choose a new password</h1>
          <p className="yk-auth-intro">
            Use a unique password that you don&apos;t use on any other site.
          </p>
          {user ? (
            <PasswordUpdateForm />
          ) : (
            <div className="yk-auth-success">
              <p role="alert" className="auth-error">
                This password reset link is invalid or has expired.
              </p>
              <Link href="/mot-de-passe-oublie" className="yk-auth-link">
                Request a new link →
              </Link>
            </div>
          )}
        </section>
      </main>
      <footer className="yk-auth-footer">
        Yokkai Collec’ · A new discovery in every card.
      </footer>
    </div>
  );
}
