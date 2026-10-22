"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/data/cards";
import "@/styles/lr-cinematic-preview.css";

export function LocalCardCinematic({
  card,
  onContinue,
  controls = true
}: {
  card: Pick<Card, "name" | "category" | "anime" | "image" | "rarity">;
  onContinue?: () => void;
  controls?: boolean;
}) {
  const [html, setHtml] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [replay, setReplay] = useState(0);
  const [paused, setPaused] = useState(false);
  const [retry, setRetry] = useState(0);
  const completed = useRef(false);
  const continueCallback = useRef(onContinue);
  const frame = useRef<HTMLIFrameElement>(null);
  const advance = () => {
    if (completed.current) return;
    completed.current = true;
    onContinue?.();
  };
  const { name, category, anime, image, rarity } = card;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const params = new URLSearchParams({
          name,
          category,
          license: anime ?? "",
          image: new URL(image, window.location.origin).href,
          rarity
        });
        const response = await fetch(
          `/design-system/card-cinematics/document?${params}`,
          {
            signal: controller.signal,
            cache: "no-store"
          }
        );
        if (!response.ok) throw new Error("Cinematic unavailable");
        const document = await response.text();
        if (active) setHtml(document);
      } catch {
        if (active) setState("error");
      } finally {
        window.clearTimeout(timeout);
      }
    });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [name, category, anime, image, rarity, retry]);

  useEffect(() => {
    if (!html) return;
    completed.current = false;
    const timeout = window.setTimeout(() => setState("error"), 15000);
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      if (event.data?.type === "YOKKAI_CARD_READY") {
        window.clearTimeout(timeout);
        setState("ready");
      } else if (event.data?.type === "YOKKAI_CARD_ERROR") {
        window.clearTimeout(timeout);
        setState("error");
      } else if (event.data?.type === "YOKKAI_CARD_COMPLETE" && !controls) {
        if (!completed.current) {
          completed.current = true;
          continueCallback.current?.();
        }
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [html, replay, controls]);

  useEffect(() => {
    continueCallback.current = onContinue;
  }, [onContinue]);

  if (process.env.NODE_ENV !== "development") return null;
  return (
    <section
      className={`yk-lr-preview yk-card-cinematic${controls ? "" : " yk-card-cinematic-clean"}`}
      aria-label={`${rarity} cinematic: ${name}`}
    >
      {html && (
        <iframe
          key={replay}
          ref={frame}
          title={`${rarity} reveal: ${name}`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          tabIndex={-1}
          srcDoc={html}
          onLoad={() =>
            frame.current?.contentWindow?.postMessage(
              { type: "yokkai-card-status" },
              "*"
            )
          }
        />
      )}
      {state !== "ready" && (
        <p
          className="yk-lr-preview-status"
          role={state === "error" ? "alert" : "status"}
        >
          {state === "error"
            ? controls
              ? "The cinematic could not load. Replay to retry, or continue safely."
              : "The cinematic could not load. Tap to continue safely."
            : "Loading cinematic…"}
        </p>
      )}
      {!controls && onContinue && (
        <div
          className="yk-card-cinematic-skip"
          role="button"
          tabIndex={0}
          aria-label="Skip cinematic"
          onClick={advance}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              advance();
            }
          }}
        />
      )}
      {controls && (
        <div className="yk-lr-preview-controls">
          <button
            type="button"
            className="yk-button yk-button-secondary"
            disabled={!html && state !== "error"}
            onClick={() => {
              setPaused(false);
              setState("loading");
              if (!html) setRetry(value => value + 1);
              setReplay(value => value + 1);
            }}
          >
            Replay cinematic
          </button>
          <button
            type="button"
            className="yk-button yk-button-secondary"
            aria-pressed={paused}
            disabled={state !== "ready"}
            onClick={() => {
              const next = !paused;
              frame.current?.contentWindow?.postMessage(
                { type: "yokkai-card-pause", paused: next },
                "*"
              );
              setPaused(next);
            }}
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
      )}
    </section>
  );
}
