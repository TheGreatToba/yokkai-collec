import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import "@/styles/auth.css";

export default async function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  if (await getCurrentUser()) redirect("/boosters");
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
        <Link href="/" className="yk-auth-return">
          <span aria-hidden="true">←</span> Retour à l’accueil
        </Link>
      </header>
      <main className="yk-auth-main">
        <section className="yk-auth-panel">{children}</section>
      </main>
      <footer className="yk-auth-footer">
        Yokkai Collec’ · À chaque carte, une découverte.
      </footer>
    </div>
  );
}
