"use client";

import { cardRarityLabel } from "@/lib/ui/card-rarity-label";
import type { CSSProperties, SyntheticEvent } from "react";
import type { Rarity } from "@/lib/data/cards";
import "@/styles/cards.css";

export type YokaiCardProps = {
  rarity: Rarity;
  shiny?: boolean;
  name: string;
  image?: string;
  category: string;
  anime?: string;
  number?: string | number;
  animated?: boolean;
  className?: string;
  fallbackImage?: string;
  catalogueImage?: string;
  imageSizes?: string;
  crossOrigin?: "anonymous";
};
const spots = [
  [12, 18],
  [78, 26],
  [20, 62],
  [70, 58],
  [48, 14],
  [84, 46],
  [8, 40],
  [58, 70]
];

export function YokaiCard({
  rarity,
  shiny = false,
  name,
  image,
  category,
  anime,
  animated = true,
  className = "",
  fallbackImage,
  catalogueImage,
  crossOrigin
}: YokaiCardProps) {
  const holo = shiny && (rarity === "SSR" || rarity === "LR");
  const franchise = anime?.trim();
  const sparkCount = !animated
    ? 0
    : holo
      ? 8
      : rarity === "LR"
        ? 4
        : rarity === "SSR"
          ? 3
          : 0;
  const artProps = {
    crossOrigin,
    src: image ?? "",
    width: 300,
    height: 420,
    loading: "lazy" as const,
    decoding: "async" as const,
    onError: (event: SyntheticEvent<HTMLImageElement>) => {
      const fallback = fallbackImage ?? catalogueImage;
      if (fallback && event.currentTarget.src !== fallback) {
        event.currentTarget.removeAttribute("srcset");
        event.currentTarget.src = fallback;
      }
    }
  };
  return (
    <div
      className={`yk-card yk-rarity-${rarity} ${holo ? "yk-shiny" : ""} ${animated ? "yk-animated" : ""} ${className}`}
    >
      <div
        className="yk-card-clip"
        role="img"
        aria-label={`${name}, ${cardRarityLabel(rarity, holo)}, ${franchise || category}`}
      >
        <div className="yk-card-frame" />
        {holo && <div className="yk-shiny-frame" />}
        <div className="yk-card-interior">
          <div className="yk-card-ring" />
          {rarity === "LR" && <div className="yk-card-line" />}
          {image && (
            <div className="yk-card-art">
              {/* Grids and details use the same original bytes for every source. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...artProps} alt="" />
            </div>
          )}
          <div className="yk-card-foil" />
          {holo && <div className="yk-holo" />}
          {spots.slice(0, sparkCount).map(([left, top], i) => (
            <span
              className="yk-sparkle"
              key={i}
              style={
                {
                  left: `${left}%`,
                  top: `${top}%`,
                  fontSize: i % 3 === 0 ? "9cqw" : "6cqw",
                  animationDelay: `${i * 0.37}s`
                } as CSSProperties
              }
            >
              ✦
            </span>
          ))}
          <div className="yk-card-content">
            <div className="yk-card-top">
              <span className="yk-card-category" title={category}>
                {category}
              </span>
              <span className="yk-card-badges">
                <span className="yk-card-badge">{rarity}</span>
                {holo && (
                  <span
                    className="yk-shiny-badge"
                    title={cardRarityLabel(rarity, holo)}
                  >
                    ✦
                  </span>
                )}
              </span>
            </div>
            {!image && (
              <span className="yk-card-missing">Illustration indisponible</span>
            )}
            <div className="yk-card-bottom">
              <span className="yk-card-name" title={name}>
                {name}
              </span>
              {franchise && (
                <span className="yk-card-anime" title={franchise}>
                  {franchise}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardBack({ className = "" }: { className?: string }) {
  const style = useOwnProfileStyle();
  return (
    <div
      role="img"
      aria-label="Yokkai Collec’ card back"
      className={`yk-card-back ${className}`}
      style={
        style?.cardBackUrl
          ? {
              backgroundImage: `url(${JSON.stringify(style.cardBackUrl)})`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }
          : undefined
      }
    />
  );
}
import { useOwnProfileStyle } from "@/components/pro-access";
