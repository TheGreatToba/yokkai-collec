"use client";

import { useEffect, useRef, useState } from "react";
import type { BoosterKind } from "@/lib/ui/booster-opening-document";
import "@/styles/booster-opening.css";

export function BoosterOpening({
  kind,
  onComplete,
  onTear
}: {
  kind: BoosterKind;
  onComplete: () => void;
  onTear: () => void;
}) {
  const [html, setHtml] = useState("");
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onComplete, onTear });
  const completed = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    callbacks.current = { onComplete, onTear };
  }, [onComplete, onTear]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const complete = () => {
      if (!active || completed.current) return;
      completed.current = true;
      callbacks.current.onComplete();
    };
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
          setReady(true);
          break;
        case "YOKKAI_BOOSTER_TEAR":
          callbacks.current.onTear();
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
        const response = await fetch(`/api/booster-opening?kind=${kind}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Opening unavailable");
        const document = await response.text();
        if (active) setHtml(document);
      } catch {
        complete();
      }
    })();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [kind]);
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
      {!ready && (
        <p className="yk-booster-opening-loading" role="status">
          Preparing your pack…
        </p>
      )}
    </div>
  );
}
