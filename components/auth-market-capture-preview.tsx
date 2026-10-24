"use client";

import {
  AuctionView,
  MarketView,
  type AuctionPresentation,
  type AuctionChatAdapter
} from "@/components/community-views";
import {
  AUTH_EVOLUTION_CARDS,
  AUTH_MARQUEE_CARDS
} from "@/lib/auth/showcase-cards";

// Demonstration data for local screenshot capture only. No live auction/chat RPC.
const cards = [
  ...new Map(
    [...AUTH_EVOLUTION_CARDS, ...AUTH_MARQUEE_CARDS].map(card => [
      card.id,
      card
    ])
  ).values()
].slice(0, 12);
const listings: AuctionPresentation[] = cards.map((card, index) => ({
  id: `showcase-auction-${index}`,
  card,
  amount: [1240, 860, 2350, 780, 320, 1100, 640, 920, 450, 1500, 590, 280][
    index
  ],
  remaining: ["00:14:56", "00:28:12", "01:04:30", "02:18:40"][index % 4],
  remainingSeconds: 896 + index * 360,
  seller: ["Nova", "Astra", "Kitsune", "Atlas"][index % 4],
  sellerId: `showcase-seller-${index % 4}`,
  bids: 3 + (index % 7)
}));
const auction: AuctionPresentation = {
  id: "showcase-madara",
  card: {
    id: "90379084-98ff-4e81-82a9-42124c619fa7",
    name: "MADARA UCHIHA",
    rarity: "LR",
    category: "ANIME/MANGA",
    anime: "Naruto",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/20f5bc4f195becf9cdd1201fbbfe4b00af9469442371cfae6cc391c175fd103f-b4b7cf67-df5b-42e6-a093-fab485c6620a"
  },
  amount: 1240,
  remaining: "00:14:56",
  remainingSeconds: 896,
  seller: "Nova",
  sellerId: "showcase-nova",
  bids: 4,
  balance: 6132,
  nextBid: 1250,
  minimumBid: 1250,
  history: [
    { id: "bid-4", name: "Astra", amount: 1240, time: "12:45" },
    { id: "bid-3", name: "Atlas", amount: 1180, time: "12:44" },
    { id: "bid-2", name: "Kitsune", amount: 1100, time: "12:43" },
    { id: "bid-1", name: "Astra", amount: 1000, time: "12:42" }
  ]
};
const chat: AuctionChatAdapter = {
  get: async () => ({
    canPost: true,
    participants: ["Nova", "Astra", "Atlas", "Kitsune"].map(pseudo => ({
      userId: `showcase-${pseudo}`,
      pseudo,
      mine: false
    })),
    messages: [
      ["Nova", "One of my favorite Naruto cards. Good luck everyone!"],
      ["Kitsune", "That artwork looks incredible."],
      ["Atlas", "This would complete my Naruto binder."],
      ["Astra", "Just placed my bid. This one is worth chasing!"]
    ].map(([pseudo, message], index) => ({
      id: `message-${index}`,
      userId: `showcase-${pseudo}`,
      pseudo,
      message,
      createdAt: `2026-10-24T12:4${index}:00Z`,
      mine: false
    }))
  }),
  send: async () => {
    throw new Error("Screenshot preview only.");
  }
};

export function AuthMarketCapturePreview({
  mode
}: {
  mode: "market" | "auction";
}) {
  return mode === "market" ? (
    <MarketView
      lists={{ active: listings, mine: [], won: [], sold: [] }}
      activeSales="0"
      pageHeading={
        <div>
          <p className="eyebrow">The auction room</p>
          <h1 className="yk-title mt-3">Market</h1>
        </div>
      }
    />
  ) : (
    <>
      <p className="yk-back-link">← Back to market</p>
      <p className="eyebrow">Market · Auction</p>
      <h1 className="yk-title mt-3">Auction details</h1>
      <AuctionView
        auction={auction}
        onBid={async () => {}}
        chatAdapter={chat}
      />
    </>
  );
}
