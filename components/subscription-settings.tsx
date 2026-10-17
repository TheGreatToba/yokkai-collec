"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { BillingSettings, BillingStatus } from "@/lib/billing/settings";

export function SubscriptionSettings({
  billing
}: {
  billing: BillingSettings;
}) {
  const [status, setStatus] = useState(billing.status);
  const [busy, setBusy] = useState<"refresh" | "checkout" | "portal" | null>(
    null
  );
  const [error, setError] = useState(
    billing.unavailable
      ? "Unable to verify your subscription. Please try again."
      : ""
  );
  const [refreshed, setRefreshed] = useState(false);
  const pending = useRef(false);
  const canSubscribe =
    billing.enabled &&
    billing.checkoutEnabled &&
    !!status &&
    !status.active &&
    ["not_subscribed", "canceled", "incomplete_expired"].includes(
      status.status
    );
  const label = !billing.enabled
    ? billing.unavailable
      ? "Status unavailable"
      : "Not available yet"
    : !status
      ? "Status unavailable"
      : status.active
        ? "Pro active"
        : status.status === "not_subscribed"
          ? "Basic"
          : status.status === "canceled"
            ? "Subscription ended"
            : status.status === "past_due"
              ? "Payment overdue"
              : "Subscription needs attention";

  async function act(action: "refresh" | "checkout" | "portal") {
    if (pending.current || !billing.enabled) return;
    if (action === "checkout" && !canSubscribe) return;
    if (action === "portal" && !status?.hasCustomer) return;
    pending.current = true;
    setBusy(action);
    setError("");
    setRefreshed(false);
    try {
      const response = await fetch(
        `/api/billing/${action === "refresh" ? "status" : action}`,
        action === "refresh"
          ? { cache: "no-store" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}"
            }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.code === "BILLING_USE_PORTAL"
            ? "A subscription already exists. Refresh your status or manage your subscription."
            : "Billing is temporarily unavailable. Please try again."
        );
        return;
      }
      if (action === "refresh") {
        setStatus(result as BillingStatus);
        setRefreshed(true);
      } else {
        const url = new URL(result.url);
        const allowed =
          action === "checkout"
            ? "https://checkout.stripe.com"
            : "https://billing.stripe.com";
        if (url.origin !== allowed || url.username || url.password)
          throw Error("Invalid destination");
        window.location.assign(url.href);
      }
    } catch {
      setError("Billing is temporarily unavailable. Please try again.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      id="subscription"
      aria-labelledby="subscription-title"
      className="mb-6 scroll-mt-24 rounded-panel border border-veil bg-surface p-6"
      aria-busy={busy !== null}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Your membership</p>
          <h2 id="subscription-title" className="mt-2 font-display text-xl">
            Yokkai Pro subscription
          </h2>
          <p className="mt-3 text-sm text-ink-2">
            €4.99 per month · No free trial.
          </p>
        </div>
        <span
          className="rounded-full border border-veil px-3 py-1 text-sm text-ink-2"
          role="status"
        >
          {label}
        </span>
      </div>
      {billing.sandbox && (
        <p className="mt-4 rounded-lg border border-veil bg-night p-3 text-sm text-ink-2">
          Test mode · No real money is charged. This tests billing only; game
          perks are unchanged.
        </p>
      )}
      {status?.endsAt && (
        <div className="mt-6 rounded-lg border border-veil bg-night p-4">
          <p className="text-xs uppercase tracking-wider text-ink-3">
            {status.cancelAtPeriodEnd
              ? "Access until"
              : status.active
                ? "Next renewal"
                : "Period end"}
          </p>
          <p className="mt-2 font-medium">
            <time dateTime={new Date(status.endsAt * 1000).toISOString()}>
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "long",
                timeZone: "UTC"
              }).format(status.endsAt * 1000)}
            </time>
          </p>
          {status.cancelAtPeriodEnd && status.active && (
            <p className="mt-2 text-sm leading-6 text-ink-2">
              Your subscription will not renew. Pro access continues until the
              end of your paid period.
            </p>
          )}
        </div>
      )}
      <p className="mt-5 max-w-2xl text-sm leading-6 text-ink-2">
        View invoices, update your payment method, or cancel your subscription
        securely with Stripe. You will return to these settings when you are
        done.
      </p>
      {!billing.enabled && !billing.unavailable && (
        <p className="mt-3 text-sm text-ink-3">
          Subscriptions are not available yet. No payment can be started.
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {refreshed && (
        <p className="mt-4 text-sm text-success" role="status">
          Subscription status updated.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {!status?.active &&
          (!status ||
            ["not_subscribed", "canceled", "incomplete_expired"].includes(
              status.status
            )) && (
            <Button
              disabled={!canSubscribe || busy !== null}
              onClick={() => void act("checkout")}
            >
              {busy === "checkout" ? "Opening checkout…" : "Get Yokkai Pro"}
            </Button>
          )}
        {status?.hasCustomer && (
          <Button disabled={busy !== null} onClick={() => void act("portal")}>
            {busy === "portal" ? "Opening Stripe…" : "Manage subscription"}
          </Button>
        )}
        {billing.enabled && (
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void act("refresh")}
          >
            {busy === "refresh" ? "Refreshing…" : "Refresh status"}
          </Button>
        )}
      </div>
    </section>
  );
}
