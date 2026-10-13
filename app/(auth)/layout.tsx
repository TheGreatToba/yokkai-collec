import Link from "next/link";
import Image from "next/image";
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
          <Image
            className="yk-auth-brand-image"
            src="/assets/header-logo-gold.png"
            alt=""
            width={1774}
            height={887}
            priority
          />
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
        {process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() && (
          <>
            {" "}
            ·{" "}
            <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL.trim()}`}>
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL.trim()}
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
