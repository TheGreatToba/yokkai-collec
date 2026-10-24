"use client";

import { useState } from "react";
import { YokaiCard } from "@/components/yokai-card";
import "@/styles/ev-badge-gallery.css";

const options = [
  {
    id: "pearl",
    name: "Pearl",
    description: "Pearl white with a soft satin finish."
  },
  {
    id: "silver",
    name: "Silver",
    description: "Light silver with a bright chrome reflection."
  },
  {
    id: "ice",
    name: "Ice",
    description: "Ice blue with a cool, luminous reflection."
  },
  {
    id: "champagne",
    name: "Champagne",
    description: "Warm ivory with a pale gold reflection."
  },
  {
    id: "jade",
    name: "Jade",
    description: "Soft mint with a polished jade reflection."
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Pale lilac with a soft violet reflection."
  },
  {
    id: "rose",
    name: "Rose",
    description: "Pink chrome with pearlescent highlights."
  },
  {
    id: "ruby",
    name: "Ruby",
    description: "Crimson chrome with bright ruby reflections."
  },
  {
    id: "amber",
    name: "Amber",
    description: "Sunlit amber with a rich golden glow."
  },
  {
    id: "sapphire",
    name: "Sapphire",
    description: "Electric blue with deep sapphire shadows."
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Vivid green with jewel-like reflections."
  },
  {
    id: "copper",
    name: "Copper",
    description: "Warm copper with peach and bronze reflections."
  }
] as const;

const characters = [
  {
    name: "Gojo",
    anime: "Jujutsu Kaisen",
    image: "/assets/landing/gojou.webp"
  },
  { name: "Luffy", anime: "One Piece", image: "/assets/landing/luffy.webp" },
  { name: "Levi", anime: "Attack on Titan", image: "/assets/landing/levi.webp" }
];

export function EvBadgeGallery() {
  const [selected, setSelected] = useState<string | null>(null);
  const [animated, setAnimated] = useState(true);
  const selectedIndex = options.findIndex(option => option.id === selected);

  return (
    <main className="ev-badge-gallery" data-animated={animated}>
      <header className="ev-studio-header">
        <div>
          <p className="ev-studio-eyebrow">EVOLVED / COLOR STUDY</p>
          <h1>Find your color.</h1>
          <p className="ev-studio-intro">
            One badge shape. Twelve color finishes, charged with branching
            lightning and a luminous edge. Choose your favorite.
          </p>
        </div>
        <label className="ev-motion-toggle">
          <input
            type="checkbox"
            checked={animated}
            onChange={event => setAnimated(event.target.checked)}
          />
          Animate cards and badges
        </label>
      </header>

      <div className="ev-studio-grid">
        {options.map((option, index) => {
          const number = String(index + 1).padStart(2, "0");
          const chosen = selected === option.id;
          return (
            <section
              key={option.id}
              className="ev-option"
              data-style={option.id}
              data-selected={chosen}
              aria-labelledby={`ev-option-${option.id}`}
            >
              <header className="ev-option-header">
                <div>
                  <p className="ev-option-number">OPTION {number}</p>
                  <h2 id={`ev-option-${option.id}`}>{option.name}</h2>
                </div>
                <div className="ev-badge-detail yk-evolved" aria-hidden="true">
                  <span className="yk-evolved-badge">ev</span>
                </div>
              </header>
              <p className="ev-option-description">{option.description}</p>
              <div className="ev-option-cards">
                {(["SSR", "LR"] as const).map((rarity, cardIndex) => {
                  const character =
                    characters[(index + cardIndex) % characters.length];
                  return (
                    <figure key={rarity}>
                      <YokaiCard
                        {...character}
                        rarity={rarity}
                        isEvolved
                        category="ANIME/MANGA"
                        animated={animated}
                      />
                      <figcaption>{rarity} EVOLVED</figcaption>
                    </figure>
                  );
                })}
              </div>
              <button
                type="button"
                className="ev-choose-button"
                aria-pressed={chosen}
                onClick={() => setSelected(chosen ? null : option.id)}
              >
                {chosen ? `Selected — ${number}` : `Choose ${number}`}
                <span aria-hidden="true">{chosen ? "✓" : "↗"}</span>
              </button>
            </section>
          );
        })}
      </div>

      <footer className="ev-studio-selection" role="status" aria-live="polite">
        <span className="ev-selection-label">YOUR PICK</span>
        <strong>
          {selectedIndex < 0
            ? "Choose a design above"
            : `${String(selectedIndex + 1).padStart(2, "0")} / ${options[selectedIndex].name}`}
        </strong>
        <span>Preview only · Your collection stays unchanged</span>
      </footer>
    </main>
  );
}
