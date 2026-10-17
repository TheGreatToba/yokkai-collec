"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  EMPTY_PREMIUM_STATE,
  PREMIUM_PLAN,
  type PremiumState
} from "@/lib/premium/plan";
import { stripePaymentDestination } from "@/lib/premium/checkout-link";

export function PremiumCheckout({
  signedIn,
  name
}: {
  signedIn: boolean;
  name: string;
}) {
  const [state, setState] = useState<PremiumState>(EMPTY_PREMIUM_STATE);
  const [loading, setLoading] = useState(signedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: PREMIUM_PLAN.currency
  }).format(PREMIUM_PLAN.amount / 100);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      try {
        const response = await fetch("/api/premium/status", {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            "Couldn't load your subscription. Please reload the page."
          );
        if (!controller.signal.aborted) {
          setState(data);
          setError("");
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load your subscription."
          );
      } finally {
        refreshing = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [signedIn]);
  async function openPayment(kind: "checkout" | "portal") {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/premium/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Couldn't open payment. Please try again."
        );
      window.location.assign(stripePaymentDestination(result.url, kind));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't open payment. Please try again."
      );
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <article
      id="membership"
      className="yk-premium-price-card yk-pro-checkout"
      aria-labelledby="membership-title"
    >
      <div className="yk-premium-plan-heading">
        <h3 id="membership-title">
          Yokkai <em>Pro</em>
        </h3>
        <span>MONTHLY MEMBERSHIP</span>
      </div>
      <p className="yk-premium-price">
        {price} <span>/ month</span>
      </p>
      <p>EUR · Renews monthly until canceled.</p>
      <ul className="yk-pro-checkout-includes">
        <li>Regular Packs every 5 minutes</li>
        <li>Decision Packs every 12 hours</li>
        <li>6 active auctions · 10 showcase characters</li>
        <li>Personalization and extra Karas achievements</li>
      </ul>
      {signedIn && <p className="yk-pro-checkout-account">For {name}</p>}
      {state.active && (
        <p role="status" className="yk-pro-subscription-active">
          Your Stripe test subscription is active.
        </p>
      )}
      {state.endsAt && (
        <p>
          {state.cancelAtPeriodEnd ? "Access ends" : "Current period ends"}{" "}
          {new Date(state.endsAt * 1000).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
          })}
          .
        </p>
      )}
      {!signedIn ? (
        <Link href="/login" className="yk-button yk-button-primary">
          Sign in to subscribe
        </Link>
      ) : (
        <Button
          disabled={loading || busy || !state.configured}
          aria-describedby={
            !loading && !state.configured ? "checkout-unavailable" : undefined
          }
          onClick={() => openPayment(state.active ? "portal" : "checkout")}
        >
          {loading
            ? "Checking subscription…"
            : busy
              ? "Opening Stripe…"
              : state.active
                ? "Manage subscription"
                : `Subscribe — ${price}/month`}
        </Button>
      )}
      {signedIn && !loading && !state.configured && (
        <p id="checkout-unavailable" className="yk-pro-checkout-unavailable">
          Subscriptions are not available yet. Please check back soon.
        </p>
      )}
      {state.hasCustomer && !state.active && (
        <Button
          variant="secondary"
          disabled={busy || !state.configured}
          onClick={() => openPayment("portal")}
        >
          Manage subscription
        </Button>
      )}
      {error && (
        <p role="alert" className="yk-premium-error yk-pro-payment-error">
          {error}
        </p>
      )}
      <p className="yk-premium-checkout-note">
        Secure checkout by Stripe. Manage billing, invoices and cancellation in
        the customer portal.
      </p>
    </article>
  );
}
