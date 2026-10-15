"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/data/cards";
import { CardBack, YokaiCard } from "@/components/yokai-card";
import {
  cardDropVideo,
  CARD_DROP_FACE_AT,
  CARD_DROP_STALL_MS,
  CARD_DROP_MAX_MS
} from "@/lib/ui/card-drop-video";
import "@/styles/card-drop-cinematic.css";

type DropCard = Card & { shiny?: boolean };

export function CardDropCinematic({
  card,
  onComplete
}: {
  card: DropCard;
  onComplete: () => void;
}) {
  const [allowed, setAllowed] = useState(false);
  const [faceUp, setFaceUp] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const finished = useRef(false);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    video.current?.pause();
    onComplete();
  }, [onComplete]);
  const clearStall = useCallback(() => {
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = null;
  }, []);
  const waitForPlayback = useCallback(() => {
    clearStall();
    stallTimer.current = setTimeout(finish, CARD_DROP_STALL_MS);
  }, [clearStall, finish]);

  useEffect(() => {
    // Never show an unmasked frame, even on a browser without mask compositing.
    const supportsMask =
      CSS.supports("mask-composite", "exclude") ||
      CSS.supports("-webkit-mask-composite", "xor");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const onMotionChange = () => {
      if (reducedMotion.matches) finish();
    };
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (
        !supportsMask ||
        reducedMotion.matches ||
        connection?.saveData ||
        !cardDropVideo(card.rarity)
      ) {
        finish();
        return;
      }
      setAllowed(true);
      waitForPlayback();
    });
    reducedMotion.addEventListener("change", onMotionChange);
    const deadline = setTimeout(finish, CARD_DROP_MAX_MS);
    return () => {
      active = false;
      clearTimeout(deadline);
      clearStall();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [card.rarity, clearStall, finish, waitForPlayback]);

  return (
    <div className={`yk-drop-cinematic yk-drop-${card.rarity.toLowerCase()}`}>
      <div className="yk-drop-cinematic-scene">
        <video
          ref={video}
          src={allowed ? (cardDropVideo(card.rarity) ?? undefined) : undefined}
          autoPlay
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          onPlaying={clearStall}
          onWaiting={waitForPlayback}
          onStalled={waitForPlayback}
          onEnded={finish}
          onError={finish}
          onTimeUpdate={event => {
            const beat =
              CARD_DROP_FACE_AT[card.rarity as keyof typeof CARD_DROP_FACE_AT];
            if (beat !== undefined && event.currentTarget.currentTime >= beat)
              setFaceUp(true);
          }}
          onCanPlay={event => {
            void event.currentTarget.play().catch(finish);
          }}
        />
        <div className="yk-drop-real-card" aria-live="polite">
          {faceUp ? <YokaiCard {...card} /> : <CardBack />}
        </div>
      </div>
      <div className="yk-drop-cinematic-controls">
        <p className="text-sm text-ink-2">
          {faceUp ? card.name : `${card.rarity} card incoming`}
        </p>
        <button
          type="button"
          className="yk-button yk-button-secondary"
          onClick={finish}
        >
          Skip animation
        </button>
      </div>
    </div>
  );
}
