"use client";

import { createContext, useContext, type ReactNode } from "react";

// Outside the explicitly enabled local trial, preserve existing player rights.
const CardCustomizationAccess = createContext(true);
export const PRO_CARD_CUSTOMIZATION_MESSAGE =
  "Card customization is available to Pro members only.";

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
  return useContext(CardCustomizationAccess);
}
