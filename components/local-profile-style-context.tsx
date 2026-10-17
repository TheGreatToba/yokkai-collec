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

const LocalStyleContext = createContext<{
  style: LocalProfileStyle;
  apply: (style: LocalProfileStyle) => void;
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
        apply: next => setStyle(normalizeLocalProfileStyle(next))
      }}
    >
      {children}
    </LocalStyleContext>
  );
}

export function useLocalProfileStyle() {
  return useContext(LocalStyleContext);
}

export function useLocalNameStyle() {
  const preview = useLocalProfileStyle();
  return preview
    ? {
        effect: preview.style.effect,
        style: localNameVariables(preview.style) as CSSProperties
      }
    : undefined;
}
