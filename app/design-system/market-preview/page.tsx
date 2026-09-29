import type { Metadata } from "next";
import { MarketPreview } from "@/components/market-preview";
import { Topbar } from "@/components/topbar";

export const metadata: Metadata = { title: "Marché preview · Yokkai Collec’", robots: { index: false, follow: false } };

export default async function MarketPreviewPage({ searchParams }: { searchParams: Promise<{ empty?: string }> }) {
  const { empty } = await searchParams;
  return <><Topbar view="market" name="Kitsune" karas={4920} notifications={[]}/><main className="mx-auto w-full max-w-[var(--layout-collection-max)] px-6 py-10"><p className="eyebrow">La salle des ventes</p><h1 className="yk-title mt-3">Marché</h1><div className="mt-8"><MarketPreview empty={empty !== undefined}/></div></main></>;
}
