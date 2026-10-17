"use client";

import { createContext, useContext, type ReactNode } from "react";

type AuctionQuota = { limit: number; active: number } | null;
const LocalAuctionQuota = createContext<AuctionQuota>(null);
export function LocalAuctionQuotaProvider({
  quota,
  children
}: {
  quota: AuctionQuota;
  children: ReactNode;
}) {
  return <LocalAuctionQuota value={quota}>{children}</LocalAuctionQuota>;
}
export const useLocalAuctionQuota = () => useContext(LocalAuctionQuota);
