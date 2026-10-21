"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/data/cards";
import "@/styles/lr-cinematic-preview.css";

type PreviewCard = Pick<Card, "name" | "category" | "anime" | "image">;

export function LocalLrCinematic({
  card,
  onContinue
}: {
  card?: PreviewCard;
  onContinue?: () => void;
}) {
  const [document, setDocument] = useState("");
  const [error, setError] = useState(false);
  const [replay, setReplay] = useState(0);
  const [paused, setPaused] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const name = card?.name;
  const category = card?.category;
  const license = card?.anime;
  const image = card?.image;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      name,
      category,
      license,
      image
    })) {
      if (value !== undefined) params.set(key, value);
    }
    let active = true;
    fetch(`/design-system/lr-cinematic/document?${params}`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then(response => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.text();
      })
      .then(html => {
        if (active) setDocument(html);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [name, category, license, image]);

  function togglePause() {
    const next = !paused;
    // The sandbox has an opaque origin; no sensitive data crosses this bridge.
    frame.current?.contentWindow?.postMessage(
      { type: "yokkai-lr-pause", paused: next },
      "*"
    );
    setPaused(next);
  }

  if (process.env.NODE_ENV !== "development") return null;
  return (
    <section className="yk-lr-preview" aria-label="Local LR cinematic preview">
      {document && (
        <iframe
          key={replay}
          ref={frame}
          title={`Legendary reveal: ${name ?? "Nino Nakano"}`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          tabIndex={-1}
          srcDoc={document}
        />
      )}
      {!document && (
        <p className="yk-lr-preview-status" role={error ? "alert" : "status"}>
          {error
            ? "The cinematic preview is unavailable. You can still continue."
            : "Loading cinematic…"}
        </p>
      )}
      <div className="yk-lr-preview-controls">
        <button
          type="button"
          className="yk-button yk-button-secondary"
          disabled={!document}
          onClick={() => {
            setPaused(false);
            setReplay(value => value + 1);
          }}
        >
          Replay cinematic
        </button>
        <button
          type="button"
          className="yk-button yk-button-secondary"
          disabled={!document}
          aria-pressed={paused}
          onClick={togglePause}
        >
          {paused ? "Resume animations" : "Pause animations"}
        </button>
        {onContinue && (
          <button
            type="button"
            className="yk-button yk-button-primary"
            onClick={onContinue}
          >
            Continue
          </button>
        )}
      </div>
    </section>
  );
}
