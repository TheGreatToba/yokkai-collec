import type { CollectedCard } from "@/lib/data/cards";

export type CollectionGroup = {
  key: string;
  cards: CollectedCard[];
  representative: CollectedCard;
  latestObtainedAt: string;
};

export const collectionGroupKey = (card: Pick<CollectedCard,"id"|"rarity"|"shiny">) =>
  `${card.id}:${card.rarity}:${card.shiny ? "shiny" : "normal"}`;

const newestFirst = (a: CollectedCard,b: CollectedCard) =>
  Date.parse(b.obtainedAt)-Date.parse(a.obtainedAt)||a.instanceId.localeCompare(b.instanceId);

export function groupCollection(cards: CollectedCard[]): CollectionGroup[] {
  const groups = new Map<string,CollectedCard[]>();
  for (const card of cards) {
    const key=collectionGroupKey(card);
    groups.set(key,[...(groups.get(key)??[]),card]);
  }
  return [...groups].map(([key,copies])=>{
    const ordered=[...copies].sort(newestFirst);
    return {
      key,
      cards: ordered,
      representative: ordered.find(card=>card.customImageUrl)??ordered[0],
      latestObtainedAt: ordered[0].obtainedAt,
    };
  });
}

// Destructive actions keep custom art when there are enough ordinary copies.
export function preservationOrder(cards: CollectedCard[]): CollectedCard[] {
  return [...cards].sort((a,b)=>Number(!!a.customImageUrl)-Number(!!b.customImageUrl)
    ||Date.parse(a.obtainedAt)-Date.parse(b.obtainedAt)||a.instanceId.localeCompare(b.instanceId));
}
