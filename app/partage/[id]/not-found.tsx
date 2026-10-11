import Link from "next/link";

export default function SharedCardNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-5 text-ink-1">
      <section className="max-w-lg text-center">
        <p className="eyebrow">Lien introuvable</p>
        <h1 className="yk-title mt-4">
          Cette carte partagée n&apos;existe plus.
        </h1>
        <p className="mt-5 text-sm text-ink-2">
          Le lien est invalide ou son propriétaire l&apos;a supprimé.
        </p>
        <Link
          className="yk-button yk-button-primary mt-8 inline-flex"
          href="/inscription"
        >
          Rejoindre Yokkai Collec&apos;
        </Link>
      </section>
    </main>
  );
}
