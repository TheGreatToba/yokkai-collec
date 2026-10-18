import Link from "next/link";
import type { BillingSettings } from "@/lib/billing/settings";

// Subscription actions live in authenticated settings, not in a second checkout flow.
export function PremiumCheckout({
  signedIn,
  billing
}: {
  signedIn: boolean;
  billing: BillingSettings | null;
}) {
  const active =
    billing?.enabled && billing.status?.active && !billing.unavailable;
  return (
    <aside id="membership" className="yk-premium-price-card">
      <p className="eyebrow">Your membership</p>
      <h2>Yokkai Pro</h2>
      <p className="yk-premium-price">
        €4.99 <small>/ month</small>
      </p>
      <p>Monthly subscription. Cancel from your account settings.</p>
      {active && (
        <p className="text-success" role="status">
          Pro active
        </p>
      )}
      {billing?.sandbox && <p role="status">Test mode · No real payment.</p>}
      {signedIn && !billing?.checkoutEnabled && !active && (
        <p>Subscriptions are not available yet.</p>
      )}
      <Link
        className="yk-button yk-button-primary"
        href={signedIn ? "/settings#subscription" : "/login?next=%2Fsettings"}
      >
        {active
          ? "Manage subscription"
          : signedIn
            ? "View membership options"
            : "Sign in to continue"}
      </Link>
      <p className="yk-pro-offer-footnote">
        Secure payments and invoices with Stripe.
      </p>
    </aside>
  );
}
