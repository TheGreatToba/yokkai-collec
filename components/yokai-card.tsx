import type { CSSProperties } from "react";
import type { Rarity } from "@/lib/data/cards";
import "@/styles/cards.css";

export type YokaiCardProps = {
  rarity: Rarity; shiny?: boolean; name: string; image?: string;
  category: string; number?: string | number; animated?: boolean; className?: string;
};
const spots = [[12,18],[78,26],[20,62],[70,58],[48,14],[84,46],[8,40],[58,70]];

export function YokaiCard({ rarity, shiny = false, name, image, category, number, animated = true, className = "" }: YokaiCardProps) {
  const holo = shiny && (rarity === "SSR" || rarity === "LR");
  const sparkCount = !animated ? 0 : holo ? 8 : rarity === "LR" ? 4 : rarity === "SSR" ? 3 : 0;
  return <div className={`yk-card yk-rarity-${rarity} ${holo ? "yk-shiny" : ""} ${animated ? "yk-animated" : ""} ${className}`} role="img" aria-label={`${name}, ${rarity}${holo ? " Shiny" : ""}, ${category}`}>
    <div className="yk-card-clip" aria-hidden="true">
      <div className="yk-card-frame" />
      {holo && <div className="yk-shiny-frame" />}
      <div className="yk-card-interior">
        <div className="yk-card-ring" />
        {rarity === "LR" && <div className="yk-card-line" />}
        {image && <div className="yk-card-art">
          {/* Unrestricted catalogue illustrations use their existing source URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" width={300} height={420} loading="lazy" decoding="async" />
        </div>}
        <div className="yk-card-foil" />
        {holo && <div className="yk-holo" />}
        {spots.slice(0,sparkCount).map(([left,top],i) => <span className="yk-sparkle" key={i} style={{ left: `${left}%`, top: `${top}%`, fontSize: i % 3 === 0 ? "9cqw" : "6cqw", animationDelay: `${i * .37}s` } as CSSProperties}>✦</span>)}
        <div className="yk-card-content">
          <div className="yk-card-top"><span className="yk-card-number">{number == null ? "" : `#${String(number).replace(/^#/, "").padStart(3, "0")}`}</span><span className="yk-card-badges"><span className="yk-card-badge">{rarity}</span>{holo && <span className="yk-shiny-badge">✦</span>}</span></div>
          {!image && <span className="yk-card-missing">Illustration indisponible</span>}
          <div className="yk-card-bottom"><span className="yk-card-name" title={name}>{name}</span><span className="yk-card-category">{category}</span></div>
        </div>
      </div>
    </div>
  </div>;
}

export function CardBack({ className = "" }: { className?: string }) {
  return <div role="img" aria-label="Dos de carte Yokkai Collec’" className={`yk-card-back ${className}`} />;
}
