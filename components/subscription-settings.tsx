"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { BillingSettings } from "@/lib/billing/settings";
import { watchBillingStatus } from "@/lib/billing/status-sync";

export function SubscriptionSettings({
  billing
}: {
  billing: BillingSettings;
}) {
  const [status, setStatus] = useState(billing.status);
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [syncError, setSyncError] = useState(
    billing.unavailable
      ? "Unable to verify your subscription. Retrying automatically."
      : ""
  );
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!billing.enabled) return;
    return watchBillingStatus(
      current => {
        setStatus(current);
        setSyncError("");
      },
      () =>
        setSyncError(
          "Unable to verify your subscription. Retrying automatically."
        ),
      () => pending.current
    );
  }, [billing.enabled]);
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

  async function act(action: "checkout" | "portal") {
    if (pending.current || !billing.enabled) return;
    if (action === "checkout" && !canSubscribe) return;
    if (action === "portal" && !status?.hasCustomer) return;
    pending.current = true;
    setBusy(action);
    setError("");
    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.code === "BILLING_USE_PORTAL"
            ? "A subscription already exists. Your status will update automatically. You can manage your subscription below."
            : "Billing is temporarily unavailable. Please try again."
        );
        return;
      }
      const url = new URL(result.url);
      const allowed =
        action === "checkout"
          ? "https://checkout.stripe.com"
          : "https://billing.stripe.com";
      if (url.origin !== allowed || url.username || url.password)
        throw Error("Invalid destination");
      window.location.assign(url.href);
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Your membership</p>
          <h2 id="subscription-title" className="mt-2 font-display text-xl">
            Yokkai Pro subscription
          </h2>
          <p className="mt-3 text-sm text-ink-2">€4.99 / month</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium sm:text-sm ${billing.enabled && status?.active && !syncError ? "border-success/30 bg-success/10 text-success" : "border-veil text-ink-2"}`}
          role="status"
        >
          {billing.enabled && status?.active && !syncError && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-success"
            />
          )}
          {label}
        </span>
      </div>
      {billing.sandbox && <p className="mt-3 text-xs text-ink-3">Test mode</p>}
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
        Manage your plan, payment method and invoices securely with Stripe.
      </p>
      {!billing.enabled && !billing.unavailable && (
        <p className="mt-3 text-sm text-ink-3">
          Subscriptions are not available yet. No payment can be started.
        </p>
      )}
      {(error || syncError) && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error || syncError}
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
      </div>
    </section>
  );
}
