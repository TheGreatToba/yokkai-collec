"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SfxName = "rumble" | "tear" | "flip" | "slide" | "sr" | "ssr" | "lr" | "shiny" | "flutter";
const STORAGE_KEY = "yokkai-sound-enabled";
const CHANGE_EVENT = "yokkai:sound-change";

type AmbientNavigator = Navigator & { audioSession?: { type: string } };

function allowNonInterruptingAudio() {
  const mobile = window.matchMedia("(pointer: coarse)").matches;
  if (!mobile) return true;
  const session = (navigator as AmbientNavigator).audioSession;
  if (!session) return false;
  try {
    session.type = "ambient";
    return true;
  } catch {
    return false;
  }
}

/** Local audio assets; missing/blocked audio must never interrupt a pack opening. */
export function useSfx() {
  const [enabled, setEnabled] = useState(true);
  const sounds = useRef(new Map<SfxName, HTMLAudioElement>());
  const play = useCallback((name: SfxName) => {
    if (!enabled || !allowNonInterruptingAudio()) return;
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
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent<boolean>(CHANGE_EVENT, { detail: next }));
  }, [enabled]);
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) queueMicrotask(() => setEnabled(saved === "true"));
    const sync = (event: Event) => setEnabled((event as CustomEvent<boolean>).detail);
    const syncStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY && event.newValue !== null) setEnabled(event.newValue === "true"); };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", syncStorage);
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener("storage", syncStorage); };
  }, []);
  useEffect(() => {
    const cache = sounds.current;
    return () => { cache.forEach(audio => { audio.pause(); audio.removeAttribute("src"); audio.load(); }); cache.clear(); };
  }, []);
  return { enabled, play, toggle };
}
