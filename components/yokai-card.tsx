"use client";

import { cardRarityLabel } from "@/lib/ui/card-rarity-label";
import type { CSSProperties, SyntheticEvent } from "react";
import type { Rarity } from "@/lib/data/cards";
import "@/styles/cards.css";

export type YokaiCardProps = {
  rarity: Rarity;
  shiny?: boolean;
  isEvolved?: boolean;
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
  isEvolved = false,
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
  const evolved =
    (isEvolved || (shiny && rarity === "SSR")) &&
    (rarity === "SSR" || rarity === "LR");
  const special = holo || evolved;
  const franchise = anime?.trim();
  const sparkCount = !animated
    ? 0
    : evolved
      ? 6
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
      className={`yk-card yk-rarity-${rarity} ${evolved ? "yk-evolved" : holo ? "yk-shiny" : ""} ${animated ? "yk-animated" : ""} ${className}`}
    >
      <div
        className="yk-card-clip"
        role="img"
        aria-label={`${name}, ${cardRarityLabel(rarity, shiny, isEvolved)}, ${franchise || category}`}
      >
        <div className="yk-card-frame" />
        {special && <div className="yk-shiny-frame" />}
        <div className="yk-card-interior">
          {rarity === "LR" && <div className="yk-card-line" />}
          {image && (
            <div className="yk-card-art">
              {/* Grids and details use the same original bytes for every source. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...artProps} alt="" />
            </div>
          )}
          <div className="yk-card-foil" />
          {special && <div className="yk-holo" />}
          {evolved && (
            <div className="yk-evolved-energy" aria-hidden="true">
              <span className="yk-evolved-scan" />
              <svg
                className="yk-evolved-lightning"
                viewBox="0 0 100 140"
                preserveAspectRatio="none"
              >
                <path
                  pathLength="100"
                  d="M3 10 8 19 5 20 12 31 7 29 10 41 4 49 M8 19 14 21 17 28 M10 41 15 44 13 50"
                />
                <path
                  pathLength="100"
                  d="M97 42 91 53 95 52 87 65 92 63 89 76 96 85 M91 53 85 55 82 61 M89 76 84 78 85 84"
                />
                <path
                  pathLength="100"
                  d="M3 87 9 96 5 95 12 107 7 105 10 118 4 129 M9 96 15 98 17 104 M10 118 17 121 20 128"
                />
                <path
                  pathLength="100"
                  d="M97 104 91 114 95 113 87 125 91 124 84 134 73 131 M91 114 85 115 82 121 M84 134 80 128 74 126"
                />
              </svg>
            </div>
          )}
          {spots.slice(0, sparkCount).map(([left, top], i) => (
            <span
              className={`yk-sparkle${evolved ? " yk-evolved-spark" : ""}`}
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
                {special && (
                  <span
                    className={`yk-shiny-badge${evolved ? " yk-evolved-badge" : ""}`}
                    title={cardRarityLabel(rarity, shiny, isEvolved)}
                  >
                    {evolved ? "EV" : "✦"}
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
