import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 py-12 text-center"
    >
      <p className="eyebrow">Erreur 404</p>
      <h1 className="yk-title">Cette page est introuvable</h1>
      <p className="text-ink-2">
        Le lien est peut-être ancien ou la page a été déplacée.
      </p>
      <Link href="/boosters" className="yk-button yk-button-primary">
        Retour au jeu
      </Link>
    </main>
  );
}
