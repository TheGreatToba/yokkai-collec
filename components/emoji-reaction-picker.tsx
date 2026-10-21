"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { REACTION_EMOJIS } from "@/lib/ui/reaction-emojis";

export function EmojiReactionPicker({
  disabled,
  selected,
  onSelect
}: {
  disabled: boolean;
  selected: string[];
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const searchId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  function close() {
    restoreFocus.current = true;
    setOpen(false);
  }
  useEffect(() => {
    if (open || disabled || !restoreFocus.current) return;
    const frame = requestAnimationFrame(() => {
      restoreFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, disabled]);
  const filtered = REACTION_EMOJIS.filter(
    item =>
      (category === "All" || category === item.group) &&
      `${item.label} ${item.id} ${item.emoji}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="yk-add-reaction"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Add emoji reaction"
        onClick={() => {
          setOpen(true);
          setQuery("");
          setCategory("All");
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M19 13a8 8 0 1 1-8-9" />
          <path d="M8 13s1 2 4 2 4-2 4-2M8 9h.01M14 9h.01M18 3v6M15 6h6" />
        </svg>
        <span>React</span>
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Pick your reaction"
        className="yk-reaction-modal"
      >
        <p className="yk-reaction-intro">
          A little emoji says a lot. Choose a reaction for this post.
        </p>
        <label htmlFor={searchId} className="sr-only">
          Search reactions
        </label>
        <input
          id={searchId}
          type="search"
          className="auth-input yk-reaction-search"
          placeholder="Search emojis…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="yk-reaction-categories" aria-label="Emoji categories">
          {["All", "Popular", "Faces", "Celebrate"].map(group => (
            <button
              type="button"
              key={group}
              aria-pressed={category === group}
              onClick={() => setCategory(group)}
            >
              {group}
            </button>
          ))}
        </div>
        <div className="yk-reaction-grid" aria-label="Emoji reactions">
          {filtered.map(item => (
            <button
              type="button"
              key={item.id}
              title={item.label}
              aria-label={`React with ${item.label}`}
              aria-pressed={selected.includes(item.id)}
              onClick={() => {
                onSelect(item.id);
                close();
              }}
            >
              <span aria-hidden="true">{item.emoji}</span>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <p className="yk-reaction-empty" role="status">
            No matching emojis. Try another search.
          </p>
        )}
        <p className="yk-reaction-hint">
          Click your reaction again to remove it.
        </p>
      </Modal>
    </>
  );
}
