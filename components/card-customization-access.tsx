"use client";

import { createContext, useContext, type ReactNode } from "react";

// Outside the explicitly enabled local trial, preserve existing player rights.
const CardCustomizationAccess = createContext<boolean | null>(null);
export const PRO_CARD_CUSTOMIZATION_MESSAGE =
  "Card customization is available to Pro members only.";
export const PRO_PROFILE_STYLE_MESSAGE =
  "Profile styling is available to Pro members only.";

export function CardCustomizationAccessProvider({
  allowed,
  children
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  return (
    <CardCustomizationAccess value={allowed}>
      {children}
    </CardCustomizationAccess>
  );
}

export function useCardCustomizationAccess() {
  return useContext(CardCustomizationAccess) !== false;
}

// null preserves existing gameplay outside the explicitly enabled local trial.
export function useLocalProPlan() {
  const allowed = useContext(CardCustomizationAccess);
  return allowed === null
    ? null
    : allowed
      ? ("pro" as const)
      : ("basic" as const);
}
