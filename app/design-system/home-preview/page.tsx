import type { Metadata } from "next";
import { Topbar } from "@/components/topbar";
import { SiteFooter } from "@/components/site-footer";
import { HomePanel } from "@/components/home-dashboard";
import { HomeHero, HomeLinks } from "@/components/home-content";
import {
  HomePackTimer,
  LatestPulls,
  BigPulls,
  HomeMarket
} from "@/components/home-live";
import { AUTH_MARQUEE_CARDS } from "@/lib/auth/showcase-cards";
import type { HomeCard, BigPull } from "@/lib/data/home";
import type { AuctionData } from "@/lib/data/market";

export const metadata: Metadata = {
  title: "Home preview · Yokkai Collec’",
  robots: { index: false, follow: false }
};

const now = Date.now();

export default function HomePreview() {
  const cards: HomeCard[] = Array.from({ length: 12 }, (_, index) => ({
    ...AUTH_MARQUEE_CARDS[index % AUTH_MARQUEE_CARDS.length],
    instanceId: `preview-${index}`,
    obtainedAt: new Date(now - index * 120000).toISOString(),
    shiny: index === 1
  }));
  const pulls: BigPull[] = cards.slice(0, 6).map((card, index) => ({
    instanceId: card.instanceId,
    obtainedAt: card.obtainedAt,
    card,
    playerId: "preview-player",
    playerName: ["Kitsune", "Moonflower", "Raven"][index % 3]
  }));
  const auctions: AuctionData[] = cards.slice(0, 6).map((card, index) => ({
    id: `preview-${index}`,
    card,
    amount: 240 + index * 380,
    endsAt: new Date(now + 1800000 + index * 600000).toISOString(),
    status: "active",
    seller: "Kitsune",
    sellerId: null,
    bids: index + 1,
    watched: false
  }));
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <Topbar view="home" name="Kitsune" karas={4920} notifications={[]} />
      <main id="main-content" className="yk-home-main">
        <HomeHero />
        <HomePanel id="home-packs" title="Regular Pack">
          <HomePackTimer
            initial={{
              available: 3,
              maximum: 3,
              nextPackAt: null,
              serverNow: now
            }}
            preview
          />
        </HomePanel>
        <HomePanel id="home-decision" title="Decision Pack">
          <HomePackTimer
            kind="decision"
            initial={{
              available: 1,
              maximum: 1,
              nextPackAt: now + 3600000,
              serverNow: now
            }}
            preview
          />
        </HomePanel>
        <HomePanel
          id="home-latest"
          title="Your latest pulls"
          href="/collection"
          link="View collection"
        >
          <LatestPulls cards={cards} />
        </HomePanel>
        <HomePanel id="home-big" title="Big pulls">
          <BigPulls pulls={pulls} />
        </HomePanel>
        <HomePanel
          id="home-market"
          title="The market"
          href="/market"
          link="Browse the market"
        >
          <HomeMarket initial={auctions} preview />
        </HomePanel>
        <HomeLinks discordEnabled />
      </main>
      <SiteFooter discordEnabled />
    </div>
  );
}
