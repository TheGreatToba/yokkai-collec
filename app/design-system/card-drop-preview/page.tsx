import { NativeCardDropPreview } from "@/components/native-card-drop-preview";

export default function Page() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
      <p className="eyebrow">
        Local preview · native CSS effects · no game API calls
      </p>
      <h1 className="yk-title mt-3">Native card drop animations</h1>
      <p className="mt-4 text-ink-2">
        Open the demo pack to reveal one SR, one SSR and one LR in sequence.
        Violet sparkles, pink ribbons and golden rays are native CSS effects.
        You can also test each rarity separately.
      </p>
      <NativeCardDropPreview />
    </main>
  );
}
