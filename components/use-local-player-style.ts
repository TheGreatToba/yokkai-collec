"use client";

import { useSyncExternalStore } from "react";
import { localPlayerStyles } from "@/lib/ui/local-player-style-store";

const noServerStyle = () => null;
export function useLocalPlayerStyle(userId?: string) {
  return useSyncExternalStore(
    localPlayerStyles.subscribe,
    () => localPlayerStyles.get(userId),
    noServerStyle
  );
}
