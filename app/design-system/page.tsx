import type { Metadata } from "next";
import { DesignSystemGallery } from "@/components/design-system-gallery";

export const metadata: Metadata = {
  title: "Design system · Yokkai Collec’",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><header className="mb-10 border-b border-veil pb-8"><p className="eyebrow">Yokkai Collec’ · Référence interne</p><h1 className="yk-title mt-3">Design system</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-ink-2">Fondations visuelles, états interactifs et politique d’animation de l’interface. Cette page n’utilise aucune donnée de jeu.</p></header><div className="space-y-6"><DesignSystemGallery /></div></main>;
}
