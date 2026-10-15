import { CardDropPreview } from "@/components/card-drop-preview";

export default function Page() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
      <p className="eyebrow">Local preview · no game API calls</p>
      <h1 className="yk-title mt-3">Card drop effects</h1>
      <p className="mt-4 text-ink-2">
        Choose a rarity, then click the pack. The supplied video effects
        surround the actual drawn card; the original embedded character is
        masked.
      </p>
      <CardDropPreview />
    </main>
  );
}
