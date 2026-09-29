"use client";

import { useEffect, useState } from "react";
import { AuctionView, MarketView, presentAuction, type AuctionPresentation } from "@/components/community-views";
import type { AuctionDetail } from "@/lib/data/market";
import { animation } from "@/lib/ui/animations";

// Local-only simulations for the design-system routes: no RPC is called.
const rarities = ["LR", "SSR", "SR", "R", "C"] as const;
const names = ["Kuro Kitsune", "Aoi Dragon", "Ren Cyber", "Yuki Frost", "Ken Flame", "Taro Shin"];
const active: AuctionPresentation[] = Array.from({ length: 12 }, (_, index) => ({
  id: `preview-${index}`,
  card: { id: `card-${index}`, name: names[index % names.length], category: "Anime", anime: ["Spirit Realm", "Neo Tokyo", "Winter Saga"][index % 3], rarity: rarities[index % rarities.length], image: "/assets/booster-pack.png" },
  amount: [4850, 1200, 850, 320, 210, 45][index % 6], remaining: ["00:02:14", "00:14:50", "01:12:00", "03:45:00", "08:10:00", "18:30:00"][index % 6], remainingSeconds: [134, 890, 4320, 13500, 29400, 66600][index % 6], seller: "KitsuneMaster", bids: 4 + index, wishlist: index === 1,
}));

export function MarketPreview({ empty = false }: { empty?: boolean }) {
  const [watched, setWatched] = useState(() => new Set(active.filter(a => a.wishlist).map(a => a.id)));
  const withWatch = (items: AuctionPresentation[]) => items.map(a => ({ ...a, wishlist: watched.has(a.id) }));
  const lists = empty ? { active: withWatch(active), mine: [], won: [], sold: [] } : { active: withWatch(active), mine: withWatch(active.slice(0, 2)).map(a => ({ ...a, status: "mine" as const })), won: withWatch(active.slice(2, 4)).map(a => ({ ...a, status: "won" as const, finished: true })), sold: withWatch(active.slice(4, 7)).map(a => ({ ...a, status: "sold" as const, finished: true })) };
  return <MarketView lists={lists} activeSales={empty ? "0" : "2"} onToggleWatch={async id => setWatched(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} />;
}

// Mirrors the server rules only to animate the preview (minimum +10, refund, +1 min in the last 5 minutes).
type Scenario = "live" | "poor" | "won" | "lost";
function previewAuction(scenario: Scenario): AuctionDetail {
  return {
    id: "preview-auction", card: { id: "card-0", name: "Kuro Kitsune", category: "Anime", anime: "Spirit Realm", rarity: "LR", image: "/assets/booster-pack.png" },
    amount: 4850, endsAt: new Date(Date.now() + (scenario === "won" || scenario === "lost" ? -1000 : 4 * 60_000 + 20_000)).toISOString(), status: scenario === "won" || scenario === "lost" ? "sold" : "active",
    seller: "KitsuneMaster", sellerId: "seller", buyerId: scenario === "won" ? "me" : "rival", bids: 3, watched: false, winner: scenario === "won" ? "Toi" : "ShadowNinja", balance: scenario === "poor" ? 1450 : 12000,
    history: [
      { id: "h3", name: "ShadowNinja", amount: 4850, createdAt: new Date(Date.now() - 42_000).toISOString(), mine: false },
      { id: "h2", name: "Toi", amount: 4840, createdAt: new Date(Date.now() - 75_000).toISOString(), mine: true },
      { id: "h1", name: "KpopFan99", amount: 4500, createdAt: new Date(Date.now() - 242_000).toISOString(), mine: false },
    ],
  };
}
export function AuctionPreview({ scenario }: { scenario: Scenario }) {
  const [raw, setRaw] = useState<AuctionDetail | null>(null);
  const [extended, setExtended] = useState(false);
  const [, setClock] = useState(0);
  // Built after mount: the simulated dates depend on the client clock.
  useEffect(() => { const frame = window.requestAnimationFrame(() => setRaw(previewAuction(scenario))); const timer = window.setInterval(() => setClock(value => value + 1), 1000); return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); }; }, [scenario]);
  if (!raw) return null;
  async function bid(amount: number) {
    if (!raw) return;
    await new Promise(resolve => window.setTimeout(resolve, 300));
    if (amount < raw.amount + 10) throw new Error("La mise doit dépasser l’offre actuelle d’au moins 10 karas.");
    if (amount > raw.balance) throw new Error("Votre solde de karas est insuffisant.");
    const lateBid = Date.parse(raw.endsAt) - Date.now() < 5 * 60_000;
    setRaw(current => current && ({ ...current, amount, buyerId: "me", bids: current.bids + 1, balance: current.balance - amount, endsAt: lateBid ? new Date(Date.parse(current.endsAt) + 60_000).toISOString() : current.endsAt,
      history: [{ id: `h${current.history.length + 1}`, name: "Toi", amount, createdAt: new Date().toISOString(), mine: true }, ...current.history] }));
    if (lateBid) { setExtended(true); window.setTimeout(() => setExtended(false), animation.market.extensionNotice); }
  }
  return <AuctionView auction={{ ...presentAuction(raw, "me"), extended }} onBid={scenario === "won" || scenario === "lost" ? undefined : bid} onToggleWatch={async () => setRaw(current => current && ({ ...current, watched: !current.watched }))} />;
}
