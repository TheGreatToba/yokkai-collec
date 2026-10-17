import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentUser, getCurrentPseudo } from "@/lib/auth/session";
import { localPremiumEnabled } from "@/lib/premium/plan";
import { PremiumOffer } from "@/components/premium-offer";
import "@/styles/premium.css";

export const metadata: Metadata = {
  title: "Yokkai Pro · Make it yours",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";
export default async function PremiumPage() {
  if (!localPremiumEnabled()) notFound();
  const user = await getCurrentUser();
  const name = user ? await getCurrentPseudo(user.id) : null;
  return (
    <div className="yk-premium-page">
      <header className="yk-premium-nav">
        <Link href="/boosters" aria-label="Yokkai Collec’, home">
          <Image
            src="/assets/brand-logo-bubble.png"
            alt=""
            width={2173}
            height={724}
            className="yk-premium-logo"
          />
        </Link>
        <span>
          YOKKAI PRO <i aria-hidden="true" />
        </span>
        <Link href="/settings">Back to settings ↗</Link>
      </header>
      <main className="yk-premium-main">
        <PremiumOffer signedIn={!!user} name={name ?? "Collector"} />
      </main>
      <footer className="yk-premium-footer">
        Yokkai Collec’ · Your collection. Your style.
      </footer>
    </div>
  );
}
