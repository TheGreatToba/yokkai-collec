import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compte supprimé · Yokkai Collec’",
  robots: { index: false, follow: false }
};

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="eyebrow">Confirmation</p>
      <h1 className="yk-title mt-3">Ton compte a été supprimé</h1>
      <p className="mt-6 leading-7 text-ink-2">
        Tes cartes, tes Karas, ton avatar et ton identité de connexion ont été
        effacés. Tes sessions ont été révoquées. Les historiques conservés
        affichent « Joueur supprimé ».
      </p>
      <Link href="/connexion" className="mt-8 inline-block underline">
        Revenir à la connexion
      </Link>
    </main>
  );
}
