"use client";

import { useRef, useState } from "react";
import { YokaiCard } from "@/components/yokai-card";
import { CardShell } from "@/components/card-shell";
import { Avatar, Button, Karas } from "@/components/ui";
import {
  AUTH_EVOLUTION_CARDS,
  AUTH_MARQUEE_CARDS
} from "@/lib/auth/showcase-cards";
import type { Card } from "@/lib/data/cards";
import "@/styles/auth-market.css";

const listings = [
  ...new Map(
    [...AUTH_EVOLUTION_CARDS, ...AUTH_MARQUEE_CARDS].map(card => [
      card.id,
      card
    ])
  ).values()
]
  .slice(0, 8)
  .map((card, index) => ({
    card,
    amount: [1240, 860, 2350, 780, 320, 1100, 640, 920][index],
    remaining: ["00:14:56", "00:28:12", "01:04:30", "02:18:40"][index % 4],
    seller: ["Nova", "Astra", "Kitsune", "Atlas"][index % 4]
  }));
const madara: Card = {
  id: "90379084-98ff-4e81-82a9-42124c619fa7",
  name: "MADARA UCHIHA",
  rarity: "LR",
  category: "ANIME/MANGA",
  anime: "Naruto",
  image:
    "https://api.yokkai-collec.com/storage/v1/object/public/card-images/20f5bc4f195becf9cdd1201fbbfe4b00af9469442371cfae6cc391c175fd103f-b4b7cf67-df5b-42e6-a093-fab485c6620a"
};
const openingBids = [
  { name: "Astra", amount: 1240 },
  { name: "Atlas", amount: 1180 },
  { name: "Kitsune", amount: 1100 },
  { name: "Astra", amount: 1000 }
];
const openingMessages = [
  { name: "Nova", text: "One of my favorite cards. Good luck everyone!" },
  { name: "Kitsune", text: "That artwork looks incredible." },
  { name: "Atlas", text: "This would complete my binder." },
  { name: "Astra", text: "Just placed my bid. This one is worth chasing!" }
];

// Every interaction stays in React state; this showcase never calls market RPCs.
export function AuthMarketShowcase() {
  const [selected, setSelected] = useState({ card: madara, seller: "Nova" });
  const [bids, setBids] = useState(openingBids);
  const [messages, setMessages] = useState(openingMessages);
  const [offer, setOffer] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const chatRef = useRef<HTMLOListElement>(null);
  const amount = bids[0].amount;

  function bid() {
    const value = offer.trim() ? Number(offer) : amount + 10;
    if (
      !Number.isSafeInteger(value) ||
      value < amount + 10 ||
      value > 1000000
    ) {
      setError(
        `Enter a whole amount between ${(amount + 10).toLocaleString("en-US")} and 1,000,000 Karas.`
      );
      return;
    }
    setBids(current =>
      [{ name: "You", amount: value }, ...current].slice(0, 6)
    );
    setOffer("");
    setError("");
  }

  return (
    <div className="yk-auth-market-showcase">
      <section
        className="yk-auth-demo-market"
        aria-label="Interactive market preview"
      >
        <header className="yk-auth-demo-header">
          <div>
            <span className="yk-auth-preview-label">THE AUCTION ROOM</span>
            <h4>Market</h4>
          </div>
          <span className="yk-auth-demo-tag">Interactive preview</span>
        </header>
        <ul
          className="yk-auth-demo-listings"
          aria-label="Example cards up for auction"
        >
          {listings.map(item => (
            <li key={item.card.id}>
              <button
                type="button"
                className="yk-auth-demo-listing"
                aria-label={`Preview auction for ${item.card.name}`}
                onClick={() => {
                  setSelected({ card: item.card, seller: item.seller });
                  setBids(
                    openingBids.map((entry, index) => ({
                      ...entry,
                      amount: Math.max(10, item.amount - index * 50)
                    }))
                  );
                  setMessages(openingMessages);
                  setOffer("");
                  setDraft("");
                  setError("");
                  detailRef.current?.focus({ preventScroll: true });
                  detailRef.current?.scrollIntoView({ block: "nearest" });
                }}
              >
                <CardShell interactive={false}>
                  <YokaiCard {...item.card} animated={false} />
                </CardShell>
                <span className="yk-auth-demo-seller">
                  <Avatar name={item.seller} size={20} />
                  {item.seller}
                </span>
                <span className="yk-auth-demo-listing-meta">
                  <time>{item.remaining}</time>
                  <Karas amount={item.amount} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="yk-auth-demo-auction"
        aria-label="Interactive auction preview"
        tabIndex={-1}
        ref={detailRef}
      >
        <header className="yk-auth-demo-header">
          <div>
            <span className="yk-auth-preview-label">MARKET · AUCTION</span>
            <h4>{selected.card.name}</h4>
            <p>
              {selected.card.anime} · listed by {selected.seller}
            </p>
          </div>
          <span className="yk-auth-demo-tag">Demo</span>
        </header>
        <div className="yk-auth-demo-auction-layout">
          <div className="yk-auth-demo-auction-left">
            <div className="yk-auth-demo-auction-art">
              <CardShell interactive={false}>
                <YokaiCard {...selected.card} animated={false} />
              </CardShell>
            </div>
            <section
              className="yk-auth-demo-history"
              aria-label="Preview bid history"
            >
              <h5>
                Bid history <span>({bids.length})</span>
              </h5>
              <ol>
                {bids.map((entry, index) => (
                  <li key={`${index}-${entry.amount}`}>
                    <Avatar name={entry.name} size={24} />
                    <div>
                      <strong>{entry.name}</strong>
                      <Karas amount={entry.amount} />
                    </div>
                    {index === 0 && (
                      <span className="yk-auth-demo-leading">Leading</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <div className="yk-auth-demo-auction-right">
            <section
              className="yk-auth-demo-bidding"
              aria-label="Try bidding in the preview"
            >
              <div className="yk-auth-demo-figures">
                <div>
                  <span>Current price</span>
                  <strong>
                    <Karas amount={amount} />
                  </strong>
                </div>
                <div>
                  <span>Time remaining</span>
                  <b>00:14:56</b>
                </div>
              </div>
              <form
                onSubmit={event => {
                  event.preventDefault();
                  bid();
                }}
              >
                <label htmlFor="preview-auction-bid">Your offer in Karas</label>
                <div>
                  <input
                    id="preview-auction-bid"
                    type="number"
                    min={amount + 10}
                    max={1000000}
                    step={1}
                    className="auth-input"
                    value={offer}
                    placeholder={(amount + 10).toLocaleString("en-US")}
                    onChange={event => setOffer(event.target.value)}
                  />
                  <Button type="submit" variant="secondary">
                    {offer ? "Place bid" : "+10 Karas"}
                  </Button>
                </div>
              </form>
              {error && (
                <p role="alert" className="yk-auth-demo-error">
                  {error}
                </p>
              )}
              <p
                role="status"
                aria-live="polite"
                className="yk-auth-demo-bid-status"
              >
                {bids[0].name === "You"
                  ? "You are leading in this preview."
                  : "Try a bid. No Karas are spent."}
              </p>
            </section>
            <section
              className="yk-auth-demo-auction-chat"
              aria-label="Preview auction chat"
            >
              <h5>
                Auction chat <span>{messages.length} messages</span>
              </h5>
              <ol ref={chatRef}>
                {messages.map((message, index) => (
                  <li key={index}>
                    <Avatar name={message.name} size={24} />
                    <div>
                      <strong>{message.name}</strong>
                      <p>{message.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <form
                onSubmit={event => {
                  event.preventDefault();
                  const text = draft.trim();
                  if (!text) return;
                  setMessages(current =>
                    [...current, { name: "You", text }].slice(-8)
                  );
                  setDraft("");
                  requestAnimationFrame(() => {
                    if (chatRef.current)
                      chatRef.current.scrollTop = chatRef.current.scrollHeight;
                  });
                }}
              >
                <label htmlFor="preview-auction-message" className="sr-only">
                  Try the preview chat
                </label>
                <input
                  id="preview-auction-message"
                  className="auth-input"
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  maxLength={160}
                  placeholder="Try the chat…"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!draft.trim()}
                >
                  Send
                </Button>
              </form>
              <p>Messages stay in this demo.</p>
            </section>
          </div>
        </div>
      </section>
      <p className="yk-auth-market-example-note">
        Interactive examples. Cards, bids and conversations are illustrative.
      </p>
    </div>
  );
}
