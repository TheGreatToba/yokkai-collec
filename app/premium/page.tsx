import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { getBillingSettings } from "@/lib/billing/settings";
import { PremiumOffer } from "@/components/premium-offer";
import "@/styles/premium.css";

export const metadata: Metadata = { title: "Yokkai Pro · Make it yours" };
export const dynamic = "force-dynamic";

export default async function PremiumPage() {
  const user = await getCurrentUser();
  const billing = user ? await getBillingSettings(user.id) : null;
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
        <span>YOKKAI PRO</span>
        <Link href={user ? "/settings#subscription" : "/login"}>
          {user ? "Manage membership ↗" : "Sign in ↗"}
        </Link>
      </header>
      <main className="yk-premium-main">
        <PremiumOffer signedIn={!!user} billing={billing} />
      </main>
      <footer className="yk-premium-footer">
        Your collection. Your style.
      </footer>
    </div>
  );
}
