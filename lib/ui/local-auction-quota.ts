import { PROPOSED_PLAN_RULES, type PreviewPlan } from "@/lib/premium/offer";

export function localAuctionLimit(plan: PreviewPlan | null) {
  return plan === null ? null : PROPOSED_PLAN_RULES[plan].concurrentAuctions;
}

export function countLiveAuctionListings(
  listings: { auctionId: string; endsAt: string }[],
  now = Date.now()
) {
  return new Set(
    listings
      .filter(item => {
        const end = Date.parse(item.endsAt);
        // A malformed end time must never free an auction slot.
        return !Number.isFinite(end) || end > now;
      })
      .map(item => item.auctionId)
  ).size;
}

export function auctionLimitMessage(limit: number) {
  return `You can have up to ${limit} active auctions at once.${limit === 3 ? " Upgrade to Pro for 6 auction slots." : " Wait for an auction to end or cancel a listing to free a slot."}`;
}
