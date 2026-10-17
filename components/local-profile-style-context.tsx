"use client";

import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  DEFAULT_LOCAL_PROFILE_STYLE,
  localNameVariables,
  normalizeLocalProfileStyle,
  type LocalProfileStyle
} from "@/lib/ui/local-profile-style";
import { localPlayerStyles } from "@/lib/ui/local-player-style-store";
import { useLocalPlayerStyle } from "@/components/use-local-player-style";
import { useCardCustomizationAccess } from "@/components/card-customization-access";

const LocalStyleContext = createContext<{
  style: LocalProfileStyle;
  apply: (style: LocalProfileStyle, ownerId?: string) => void;
} | null>(null);

export function LocalProfileStyleProvider({
  children
}: {
  children: ReactNode;
}) {
  const [style, setStyle] = useState(DEFAULT_LOCAL_PROFILE_STYLE);
  return (
    <LocalStyleContext
      value={{
        style,
        apply: (next, ownerId) => {
          const safe = normalizeLocalProfileStyle(next);
          setStyle(safe);
          if (ownerId) localPlayerStyles.publish(ownerId, safe);
        }
      }}
    >
      {children}
    </LocalStyleContext>
  );
}

export function useLocalProfileStyle(ownerId?: string) {
  const preview = useContext(LocalStyleContext);
  const saved = useLocalPlayerStyle(ownerId);
  const canStyleProfile = useCardCustomizationAccess();
  return preview
    ? {
        style: saved ?? preview.style,
        apply: (next: LocalProfileStyle) => {
          if (!canStyleProfile) return;
          preview.apply(next, ownerId);
        }
      }
    : null;
}

export function useLocalNameStyle(ownerId?: string) {
  const preview = useLocalProfileStyle(ownerId);
  const allowed = useCardCustomizationAccess();
  if (!allowed) return undefined;
  return preview
    ? {
        effect: preview.style.effect,
        style: localNameVariables(preview.style) as CSSProperties
      }
    : undefined;
}
