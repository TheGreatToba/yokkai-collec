"use client";

import type { CSSProperties } from "react";
import type { Rarity } from "@/lib/data/cards";
import "@/styles/cards.css";

export type YokaiCardProps = {
  rarity: Rarity; shiny?: boolean; name: string; image?: string;
  category: string; anime?: string; number?: string | number; animated?: boolean; className?: string; fallbackImage?: string; catalogueImage?: string;
};
const spots = [[12,18],[78,26],[20,62],[70,58],[48,14],[84,46],[8,40],[58,70]];

export function YokaiCard({ rarity, shiny = false, name, image, category, anime, animated = true, className = "", fallbackImage, catalogueImage }: YokaiCardProps) {
  const holo = shiny && (rarity === "SSR" || rarity === "LR");
  const franchise = anime?.trim();
  const sparkCount = !animated ? 0 : holo ? 8 : rarity === "LR" ? 4 : rarity === "SSR" ? 3 : 0;
  return <div className={`yk-card yk-rarity-${rarity} ${holo ? "yk-shiny" : ""} ${animated ? "yk-animated" : ""} ${className}`}>
    <div className="yk-card-clip" role="img" aria-label={`${name}, ${rarity}${holo ? " Shiny" : ""}, ${franchise || category}`}>
      <div className="yk-card-frame" />
      {holo && <div className="yk-shiny-frame" />}
      <div className="yk-card-interior">
        <div className="yk-card-ring" />
        {rarity === "LR" && <div className="yk-card-line" />}
        {image && <div className="yk-card-art">
          {/* Unrestricted catalogue illustrations use their existing source URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" width={300} height={420} loading="lazy" decoding="async" onError={event => {
            const fallback = fallbackImage ?? catalogueImage;
            if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
          }} />
        </div>}
        <div className="yk-card-foil" />
        {holo && <div className="yk-holo" />}
        {spots.slice(0,sparkCount).map(([left,top],i) => <span className="yk-sparkle" key={i} style={{ left: `${left}%`, top: `${top}%`, fontSize: i % 3 === 0 ? "9cqw" : "6cqw", animationDelay: `${i * .37}s` } as CSSProperties}>✦</span>)}
        <div className="yk-card-content">
          <div className="yk-card-top"><span className="yk-card-category" title={category}>{category}</span><span className="yk-card-badges"><span className="yk-card-badge">{rarity}</span>{holo && <span className="yk-shiny-badge">✦</span>}</span></div>
          {!image && <span className="yk-card-missing">Illustration indisponible</span>}
          <div className="yk-card-bottom"><span className="yk-card-name" title={name}>{name}</span>{franchise && <span className="yk-card-anime" title={franchise}>{franchise}</span>}</div>
        </div>
      </div>
    </div>
  </div>;
}

export function CardBack({ className = "" }: { className?: string }) {
  return <div role="img" aria-label="Dos de carte Yokkai Collec’" className={`yk-card-back ${className}`} />;
}
