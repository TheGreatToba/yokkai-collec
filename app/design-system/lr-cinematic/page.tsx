import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LocalLrCinematic } from "@/components/local-lr-cinematic";

export const metadata: Metadata = {
  title: "Local LR cinematic · Yokkai Collec’",
  robots: { index: false, follow: false }
};

export default function LrCinematicPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="yk-lr-demo">
      <header>
        <div>
          <h1>Legendary cinematic</h1>
          <p>Local preview only. No packs consumed, no collection changes.</p>
        </div>
        <Link href="/boosters" className="yk-button yk-button-secondary">
          Back to packs
        </Link>
      </header>
      <LocalLrCinematic />
    </main>
  );
}
