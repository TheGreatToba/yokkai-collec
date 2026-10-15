import { NativeCardDropPreview } from "@/components/native-card-drop-preview";

export default function Page() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
      <p className="eyebrow">
        Local preview · native CSS effects · no game API calls
      </p>
      <h1 className="yk-title mt-3">Native card drop animations</h1>
      <p className="mt-4 text-ink-2">
        Select a rarity, then click the pack. The actual drawn card flips in 3D:
        violet sparkles for SR, pink ribbons for SSR and golden rays for LR. No
        video player.
      </p>
      <NativeCardDropPreview />
    </main>
  );
}
