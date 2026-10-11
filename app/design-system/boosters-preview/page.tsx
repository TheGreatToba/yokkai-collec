import type { Metadata } from "next";
import { BoostersPreview } from "@/components/boosters-preview";
import { Topbar } from "@/components/topbar";

export const metadata: Metadata = {
  title: "Boosters preview · Yokkai Collec’",
  robots: { index: false, follow: false }
};

export default function BoostersPreviewPage() {
  return (
    <>
      <Topbar view="packs" name="Kitsune" karas={4920} notifications={[]} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="eyebrow">Une ouverture. Cinq destins.</p>
        <h1 className="yk-title mt-3">Tes boosters</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-ink-2">
          Brise le sceau. Révèle les cartes qui rejoindront ta collection.
        </p>
        <BoostersPreview />
      </main>
    </>
  );
}
