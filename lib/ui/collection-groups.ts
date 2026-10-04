import type { CollectedCard } from "@/lib/data/cards";

export type CollectionGroup = {
  key: string;
  cards: CollectedCard[];
  representative: CollectedCard;
  firstObtainedAt: string;
  isFirstOwner: boolean;
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
      firstObtainedAt: ordered[ordered.length-1].obtainedAt,
      isFirstOwner: ordered.some(card=>card.rarity==="LR"&&card.isFirstOwner),
    };
  });
}

// Destructive actions keep custom art when there are enough ordinary copies.
export function preservationOrder(cards: CollectedCard[]): CollectedCard[] {
  return [...cards].sort((a,b)=>Number(!!a.customImageUrl)-Number(!!b.customImageUrl)
    ||Date.parse(a.obtainedAt)-Date.parse(b.obtainedAt)||a.instanceId.localeCompare(b.instanceId));
}

export function consumableCopies(cards: CollectedCard[], isFrozen: (instanceId: string) => boolean): CollectedCard[] {
  return preservationOrder(cards.filter(card=>!isFrozen(card.instanceId)));
}

export function consumptionPlan(cards: CollectedCard[], quantity: number, isFrozen: (instanceId: string) => boolean): CollectedCard[] {
  return consumableCopies(cards,isFrozen).slice(0,Math.max(0,quantity));
}
