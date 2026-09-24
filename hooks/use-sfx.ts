"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SfxName = "rumble" | "tear" | "flip" | "slide" | "sr" | "ssr" | "lr" | "shiny" | "flutter";

/** Local audio assets; missing/blocked audio must never interrupt a pack opening. */
export function useSfx() {
  const [enabled, setEnabled] = useState(true);
  const sounds = useRef(new Map<SfxName, HTMLAudioElement>());
  const play = useCallback((name: SfxName) => {
    if (!enabled) return;
    let audio = sounds.current.get(name);
    if (!audio) {
      audio = new Audio(`/assets/sfx/${name}.wav`);
      audio.preload = "auto";
      audio.volume = name === "rumble" ? .22 : .35;
      sounds.current.set(name, audio);
    }
    audio.currentTime = 0;
    void audio.play().catch(() => { /* Autoplay or unavailable audio: continue silently. */ });
  }, [enabled]);
  const toggle = useCallback(() => {
    sounds.current.forEach(audio => { audio.pause(); audio.currentTime = 0; });
    setEnabled(value => !value);
  }, []);
  useEffect(() => {
    const cache = sounds.current;
    return () => { cache.forEach(audio => { audio.pause(); audio.removeAttribute("src"); audio.load(); }); cache.clear(); };
  }, []);
  return { enabled, play, toggle };
}
