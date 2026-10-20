import type { Metadata } from "next";
import { InfoSection, PublicInfoPage } from "@/components/public-info-page";
import { getDiscordInviteUrl } from "@/lib/discord-invite";

export const metadata: Metadata = {
  title: "Card rarities · Yokkai Collec'",
  description: "Learn how Yokkai card rarities and pack odds work."
};

const regularRarities = [
  ["C", "Common", "72.4%"],
  ["R", "Rare", "20%"],
  ["SR", "Super Rare", "7%"],
  ["SSR", "Super Super Rare", "0.5%"],
  ["LR", "Legendary Rare", "0.1%"]
] as const;

export default function RaritiesPage() {
  return (
    <PublicInfoPage
      eyebrow="Collector guide"
      title="Card rarities"
      intro="Every card belongs to one of five rarity tiers. The rarer the tier, the harder it is to pull and the more distinctive its presentation becomes."
      discordEnabled={Boolean(getDiscordInviteUrl())}
    >
      <InfoSection number="01" title="The five tiers">
        <div className="yk-rarity-list">
          {regularRarities.map(([code, name, odds]) => (
            <div className="yk-rarity-row" data-rarity={code} key={code}>
              <strong>{code}</strong>
              <span>{name}</span>
              <b>{odds}</b>
            </div>
          ))}
        </div>
        <p>
          The percentages above are the current Regular Pack odds for each
          individual card draw.
        </p>
      </InfoSection>
      <InfoSection number="02" title="Decision Packs">
        <p>
          Decision Packs only contain high-rarity choices: SR at 96.5%, SSR at
          3%, and LR at 0.5%. You reveal five cards and choose the one you want
          to keep.
        </p>
      </InfoSection>
      <InfoSection number="03" title="Special card states">
        <p>
          Shiny and evolved cards are special versions, not separate rarity
          tiers. Their visual treatment and collection status appear directly on
          the card.
        </p>
      </InfoSection>
      <InfoSection number="04" title="Live odds">
        <p>
          Pack odds may be rebalanced as the collection grows. The information
          panel beside each pack always shows the live rates used by the server.
        </p>
      </InfoSection>
    </PublicInfoPage>
  );
}
