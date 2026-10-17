"use client";

import { createContext, useContext, type ReactNode } from "react";
import { LocalProfileStyleProvider } from "@/components/local-profile-style-context";

// Visual preview only. This context never grants a subscription or game rights.
const LocalBadgePreview = createContext(false);

export function LocalProBadgePreview({ children }: { children: ReactNode }) {
  return (
    <LocalBadgePreview value={true}>
      <LocalProfileStyleProvider>{children}</LocalProfileStyleProvider>
    </LocalBadgePreview>
  );
}

export function LocalProProfileBadge({ isMe }: { isMe: boolean }) {
  const enabled = useContext(LocalBadgePreview);
  if (!enabled || !isMe) return null;
  return (
    <span
      className="yk-profile-pro-badge"
      role="img"
      aria-label="Yokkai Pro (local preview)"
      title="Yokkai Pro"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m12 2 2.9 7.1L22 12l-7.1 2.9L12 22l-2.9-7.1L2 12l7.1-2.9L12 2Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
