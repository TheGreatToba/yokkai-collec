"use client";

import { useEffect, useRef, useState } from "react";
import type { BoosterKind } from "@/lib/ui/booster-opening-document";
import "@/styles/booster-opening.css";

export function BoosterOpening({
  kind,
  openRequested,
  onComplete,
  onTear
}: {
  kind: BoosterKind;
  /** Undefined keeps the legacy automatic playback contract. */
  openRequested?: boolean;
  onComplete: () => void;
  onTear: () => void;
}) {
  const [html, setHtml] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ onComplete, onTear });
  const completed = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const requested = useRef(openRequested ?? true);
  const unavailable = useRef(false);
  const releasePending = useRef<(() => void) | null>(null);
  const waitForClick = openRequested !== undefined;
  useEffect(() => {
    callbacks.current = { onComplete, onTear };
  }, [onComplete, onTear]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const complete = () => {
      if (!active || completed.current) return;
      if (!requested.current) {
        unavailable.current = true;
        setFailed(true);
        setReady(true);
        return;
      }
      completed.current = true;
      callbacks.current.onComplete();
    };
    releasePending.current = complete;
    // If the decorative document or its images cannot load, show the actual draw.
    const timeout = window.setTimeout(() => {
      controller.abort();
      complete();
    }, 16000);
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      switch (event.data?.type) {
        case "YOKKAI_BOOSTER_READY":
          if (waitForClick) window.clearTimeout(timeout);
          setReady(true);
          break;
        case "YOKKAI_BOOSTER_TEAR":
          if (requested.current) callbacks.current.onTear();
          break;
        case "YOKKAI_BOOSTER_ERROR":
        case "YOKKAI_BOOSTER_COMPLETE":
          window.clearTimeout(timeout);
          complete();
          break;
      }
    };
    window.addEventListener("message", receive);
    void (async () => {
      try {
        const response = await fetch(
          `/api/booster-opening?kind=${kind}${waitForClick ? "&gesture=click" : ""}`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );
        if (!response.ok) throw new Error("Opening unavailable");
        const document = await response.text();
        if (active) setHtml(document);
      } catch {
        complete();
      }
    })();
    return () => {
      active = false;
      releasePending.current = null;
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [kind, waitForClick]);
  useEffect(() => {
    requested.current = openRequested ?? true;
    if (!waitForClick || !requested.current) return;
    if (unavailable.current) {
      releasePending.current?.();
      return;
    }
    // READY also retries a gesture made before the iframe or its media loaded.
    frame.current?.contentWindow?.postMessage(
      { type: "yokkai-booster-open" },
      "*"
    );
    const timeout = window.setTimeout(() => releasePending.current?.(), 16000);
    return () => window.clearTimeout(timeout);
  }, [openRequested, ready, waitForClick]);
  return (
    <div className="yk-booster-opening">
      {html && (
        <iframe
          ref={frame}
          title={`Opening ${kind === "decision" ? "Decision" : "Regular"} Pack`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          tabIndex={-1}
          aria-hidden="true"
          srcDoc={html}
          onLoad={() =>
            frame.current?.contentWindow?.postMessage(
              { type: "yokkai-booster-status" },
              "*"
            )
          }
        />
      )}
      {failed && (
        // The decorative document failed; keep an intact real pack until clicked.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="yk-booster-opening-fallback"
          src={`/assets/chrome-${kind}-booster-v1.png`}
          alt=""
        />
      )}
      {!ready && (
        <p className="yk-booster-opening-loading" role="status">
          Preparing your pack…
        </p>
      )}
      {ready && waitForClick && !openRequested && (
        <p className="yk-booster-opening-prompt" role="status">
          Click the pack or press Enter to open
        </p>
      )}
    </div>
  );
}
