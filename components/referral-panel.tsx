"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createReferralLink,
  type ReferralActionState
} from "@/app/settings/referral-actions";
import type { ReferralStatus } from "@/lib/referrals/shared";
import { Button } from "@/components/ui";

export function ReferralPanel({
  initialStatus,
  siteOrigin
}: {
  initialStatus: ReferralStatus;
  siteOrigin: string;
}) {
  const [state, action, pending] = useActionState<
    ReferralActionState,
    FormData
  >(createReferralLink, {});
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const code = state.code ?? initialStatus.code;
  const link = useMemo(
    () => (code ? `${siteOrigin}/signup?ref=${encodeURIComponent(code)}` : ""),
    [code, siteOrigin]
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section
      id="referrals"
      className="mt-6 rounded-panel border border-veil bg-surface p-6"
    >
      <p className="eyebrow">Invite friends</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl">Your referral link</h2>
          <p className="mt-3 text-sm leading-6 text-ink-2">
            Share your personal link. When a friend creates an account and
            verifies their email, you receive 5 bonus Regular Packs.
          </p>
        </div>
        <dl className="grid min-w-52 grid-cols-2 gap-4 text-center">
          <div className="rounded-card border border-veil bg-ink/20 p-3">
            <dt className="text-xs text-ink-3">Verified friends</dt>
            <dd className="mt-1 text-lg font-bold">
              {initialStatus.verifiedReferrals}
            </dd>
          </div>
          <div className="rounded-card border border-veil bg-ink/20 p-3">
            <dt className="text-xs text-ink-3">Packs earned</dt>
            <dd className="mt-1 text-lg font-bold">
              {initialStatus.packsEarned}
            </dd>
          </div>
        </dl>
      </div>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {state.error}
        </p>
      )}
      {link ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="referral-link">
            Referral link
          </label>
          <input
            id="referral-link"
            className="yk-field-control min-w-0 flex-1"
            readOnly
            value={link}
            onFocus={event => event.currentTarget.select()}
          />
          <Button type="button" onClick={() => void copyLink()}>
            {copyState === "copied" ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : (
        <form action={action} className="mt-5">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating link…" : "Create my referral link"}
          </Button>
        </form>
      )}
      {copyState === "error" && (
        <p role="alert" className="mt-3 text-sm text-danger">
          Couldn&apos;t copy automatically. Select and copy the link above.
        </p>
      )}
      {initialStatus.bonusPacks > 0 && (
        <p className="mt-4 text-sm text-success">
          {initialStatus.bonusPacks} bonus pack
          {initialStatus.bonusPacks === 1 ? "" : "s"} ready to open.
        </p>
      )}
    </section>
  );
}
