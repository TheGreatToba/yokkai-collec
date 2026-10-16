"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  deleteAccountAction,
  reconnectForDeletion
} from "@/app/settings/actions";

export function AccountDeletionForm({ pseudo }: { pseudo: string }) {
  const [state, action, pending] = useActionState(deleteAccountAction, {});
  const [reconnectState, reconnectAction, reconnecting] = useActionState(
    reconnectForDeletion,
    {}
  );
  return (
    <section
      className="rounded-panel border border-danger bg-surface p-6"
      aria-labelledby="delete-account-title"
    >
      <h2 id="delete-account-title" className="font-display text-xl">
        Delete my account
      </h2>
      <p
        id="delete-account-consequences"
        className="mt-3 text-sm leading-6 text-ink-2"
      >
        Deleting your account is permanent. All your cards, Karas, avatar, and
        profile data will be deleted. Your active listings will be canceled and
        bidders refunded. Your leading bids will be refunded and removed; other
        players&apos; auctions will continue. Your pending trades will be
        canceled. Retained history will show “Deleted player”.
      </p>
      <p className="mt-3 text-sm leading-6 text-ink-2">
        <a href="#mes-donnees" className="underline underline-offset-4">
          Export my data first
        </a>
      </p>
      <p className="mt-3 text-sm leading-6 text-ink-2">
        To protect your account, you must have signed in within the last five
        minutes.
      </p>
      <form action={action} className="mt-6 grid gap-4" aria-busy={pending}>
        <fieldset
          disabled={pending || Boolean(state.reconnect)}
          className="grid gap-4"
        >
          <label htmlFor="delete-account-pseudo" className="yk-field-label">
            Re-enter your username: {pseudo}
          </label>
          <input
            id="delete-account-pseudo"
            name="pseudo"
            required
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            className="yk-field-control"
            aria-describedby="delete-account-consequences delete-account-error"
            aria-invalid={Boolean(state.error)}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Deleting account…" : "Permanently delete my account"}
          </Button>
        </fieldset>
        <p
          id="delete-account-error"
          role={state.error ? "alert" : undefined}
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      </form>
      {state.reconnect && (
        <form action={reconnectAction} className="mt-4">
          <Button type="submit" disabled={reconnecting}>
            {reconnecting ? "Signing out…" : "Sign in again"}
          </Button>
          {reconnectState.error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {reconnectState.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
