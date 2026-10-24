"use client";

import { useState } from "react";
import { CardShell } from "@/components/card-shell";
import { YokaiCard } from "@/components/yokai-card";
import { AUTH_BINDER_CARDS as cards } from "@/lib/auth/binder-preview-cards";
import "@/styles/auth-binder.css";

const ownedCount = cards.filter(card => card.owned).length;

export function AuthBinderShowcase() {
  const [query, setQuery] = useState("");
  const [hideMissing, setHideMissing] = useState(false);
  const [pinned, setPinned] = useState(true);
  const normalized = query.trim().toLocaleLowerCase("en-US");
  const visible = cards.filter(
    card =>
      (!hideMissing || card.owned) &&
      card.name.toLocaleLowerCase("en-US").includes(normalized)
  );

  return (
    <section
      className="yk-auth-binder-demo"
      aria-label="Interactive Naruto binder preview"
    >
      <header className="yk-auth-binder-demo-header">
        <div>
          <span className="yk-auth-preview-label">BINDER</span>
          <h4>Naruto</h4>
        </div>
        <div className="yk-auth-binder-demo-summary">
          <strong>
            {ownedCount} / {cards.length} cards
          </strong>
          <button
            type="button"
            aria-label={pinned ? "Unpin Naruto binder" : "Pin Naruto binder"}
            aria-pressed={pinned}
            onClick={() => setPinned(current => !current)}
          >
            <span aria-hidden="true">{pinned ? "★" : "☆"}</span>
          </button>
        </div>
      </header>
      <div
        className="yk-auth-binder-demo-progress"
        role="progressbar"
        aria-label="Example Naruto binder completion"
        aria-valuemin={0}
        aria-valuemax={cards.length}
        aria-valuenow={ownedCount}
      >
        <span style={{ width: `${(ownedCount / cards.length) * 100}%` }} />
      </div>
      <div className="yk-auth-binder-demo-controls">
        <label className="yk-auth-binder-demo-search">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <span className="sr-only">Search the example Naruto binder</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search cards…"
          />
        </label>
        <button
          type="button"
          className="yk-auth-binder-demo-toggle"
          aria-pressed={hideMissing}
          onClick={() => setHideMissing(current => !current)}
        >
          <span aria-hidden="true">{hideMissing ? "●" : "○"}</span>
          {hideMissing ? "Show missing cards" : "Hide missing cards"}
        </button>
      </div>
      <p className="sr-only" role="status">
        {visible.length} {visible.length === 1 ? "card" : "cards"} shown
      </p>
      {visible.length ? (
        <ul
          className="yk-auth-binder-demo-grid"
          aria-label="Example Naruto binder cards"
        >
          {visible.map(card => (
            <li
              key={card.id}
              data-owned={card.owned}
              aria-label={`${card.name}, ${card.owned ? "collected" : "missing"}`}
            >
              <CardShell interactive={false}>
                <YokaiCard
                  {...card}
                  animated={false}
                  className={card.owned ? "" : "yk-panini-missing-card"}
                />
              </CardShell>
              <span className="yk-auth-binder-demo-card-status">
                {card.owned ? "Collected" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="yk-auth-binder-demo-empty">
          <p>No cards match your search.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setHideMissing(false);
            }}
          >
            Reset preview
          </button>
        </div>
      )}
      <p className="yk-auth-binder-demo-note">
        Illustrative binder. Collected cards stand out; missing cards stay
        visible so you know what to chase next.
      </p>
    </section>
  );
}
