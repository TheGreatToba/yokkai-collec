"use client";

import type { CSSProperties, SyntheticEvent } from "react";
import Image from "next/image";
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

function optimizableCatalogueImage(image?: string) {
  if (!image || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  try {
    const source = new URL(image),
      supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    return (
      source.protocol === "https:" &&
      source.origin === supabase.origin &&
      !source.username &&
      !source.password &&
      source.pathname.startsWith("/storage/v1/object/public/card-images/") &&
      !source.search &&
      !source.hash
    );
  } catch {
    return false;
  }
}

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
  imageSizes
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
  // Only grid callers opt in. Details/reveals/zoom keep the original bytes.
  const optimized = !!imageSizes && optimizableCatalogueImage(image);
  const artProps = {
    src: image ?? "",
    width: 300,
    height: 420,
    loading: "lazy" as const,
    decoding: "async" as const,
    onError: (event: SyntheticEvent<HTMLImageElement>) => {
      const fallback =
        fallbackImage ?? catalogueImage ?? (optimized ? image : undefined);
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
        aria-label={`${name}, ${rarity}${holo ? " Shiny" : ""}, ${franchise || category}`}
      >
        <div className="yk-card-frame" />
        {holo && <div className="yk-shiny-frame" />}
        <div className="yk-card-interior">
          <div className="yk-card-ring" />
          {rarity === "LR" && <div className="yk-card-line" />}
          {image && (
            <div className="yk-card-art">
              {/* Only public catalogue storage is proxied; custom and external sources stay native. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {optimized ? (
                <Image {...artProps} alt="" sizes={imageSizes} quality={85} />
              ) : (
                <img {...artProps} alt="" />
              )}
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
                {holo && <span className="yk-shiny-badge">✦</span>}
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
  return (
    <div
      role="img"
      aria-label="Dos de carte Yokkai Collec’"
      className={`yk-card-back ${className}`}
    />
  );
}
