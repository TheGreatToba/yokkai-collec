import { CollectionPreviewClient } from "@/components/collection-preview";
import type { CollectedCard } from "@/lib/data/cards";

const cards: CollectedCard[] = Array.from({ length: 6 }, (_, i) => ({
  id: "ur-preview",
  instanceId: `ur-copy-${i}`,
  name: "UR evolution preview",
  category: "Anime",
  anime: "Spirit Realm",
  rarity: "SSR",
  image: "/assets/card-back.png",
  catalogueImage: "/assets/card-back.png",
  customImageUrl: null,
  folderId: null,
  obtainedAt: "2026-10-15T12:00:00Z",
  shiny: false,
  isEvolved: false,
  isFirstOwner: false
}));

export default function UrEvolutionPreview() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="yk-title mb-6">SSR to UR · local simulation</h1>
      <CollectionPreviewClient cards={cards} />
    </main>
  );
}
