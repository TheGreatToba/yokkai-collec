"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";

const previews = [
  {
    title: "Browse the market",
    description: "Find your next favorite among cards up for auction.",
    src: "/assets/auth-market-preview.webp",
    alt: "Market preview showing twelve cards for auction, with rarity filters, prices in Karas and countdowns.",
    width: 1956,
    height: 1140
  },
  {
    title: "Join the bidding",
    description:
      "Follow the offers and chat with the seller and other bidders.",
    src: "/assets/auth-auction-preview.webp",
    alt: "Madara Uchiha LR auction preview with four bids in the history on the left, the bidding panel in the center and collectors talking in the chat on the right.",
    width: 2000,
    height: 1305
  }
];

export function AuthMarketShowcase() {
  const [selected, setSelected] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const preview = selected === null ? undefined : previews[selected];

  return (
    <div className="yk-auth-market-showcase">
      {previews.map((item, index) => (
        <figure className="yk-auth-market-figure" key={item.src}>
          <figcaption>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </figcaption>
          <button
            type="button"
            className="yk-auth-market-image"
            aria-label={`Open ${item.title.toLowerCase()} preview`}
            aria-haspopup="dialog"
            onClick={() => {
              setZoomed(false);
              setSelected(index);
            }}
          >
            <Image
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes="(max-width: 760px) 100vw, 820px"
            />
            <span className="yk-auth-market-open" aria-hidden="true">
              View larger ↗
            </span>
          </button>
        </figure>
      ))}
      <p className="yk-auth-market-example-note">
        Illustrative previews. Cards, bids and chat are examples.
      </p>
      <Modal
        open={preview !== undefined}
        onClose={() => setSelected(null)}
        title={preview?.title ?? "Market preview"}
        className="yk-auth-market-modal"
      >
        {preview && (
          <>
            <div className="yk-auth-market-image-toolbar">
              <p>Zoom in to read the bids and chat.</p>
              <Button
                variant="secondary"
                aria-pressed={zoomed}
                onClick={() => setZoomed(current => !current)}
              >
                {zoomed ? "Fit image" : "Zoom in"}
              </Button>
            </div>
            <div className={`yk-auth-market-zoom${zoomed ? " is-zoomed" : ""}`}>
              {/* Keep the original capture available when zooming to read the UI. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.src}
                alt={preview.alt}
                width={preview.width}
                height={preview.height}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
