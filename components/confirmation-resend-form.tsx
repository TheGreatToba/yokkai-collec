"use client";

import { AuthTurnstile } from "@/components/auth-turnstile";

import { useActionState, useEffect, useState } from "react";
import { resendConfirmation } from "@/app/auth/actions";
import { authError, type AuthState } from "@/lib/auth/forms";

export function ConfirmationResendForm({
  email = "",
  initialDelay = 0
}: {
  email?: string;
  initialDelay?: number;
}) {
  const [remaining, setRemaining] = useState(initialDelay);
  const waiting = remaining > 0;
  const [state, action, pending] = useActionState<AuthState, FormData>(
    async (previous, form) => {
      try {
        const result = await resendConfirmation(previous, form);
        setRemaining(result.retryAfter ?? 0);
        return result;
      } catch {
        setRemaining(60);
        return { error: authError() };
      }
    },
    {}
  );
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(
      () => setRemaining(value => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [waiting]);

  return (
    <form action={action} className="yk-auth-form" aria-busy={pending}>
      <p>
        If this email address belongs to an account awaiting confirmation,
        you&apos;ll receive a new link. Check your spam folder too.
      </p>
      {state.success && (
        <p role="status" className="yk-auth-notice">
          If confirmation is needed, we&apos;ll send you an email. If your
          account is already confirmed, you can sign in.
        </p>
      )}
      {state.error && (
        <p role="alert" className="auth-error">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">Resend email confirmation</legend>
        <label htmlFor="confirmation-email" className="auth-label">
          Email address to confirm
        </label>
        <input
          id="confirmation-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.values?.email ?? email}
          className="auth-input"
          aria-invalid={Boolean(state.fields?.email)}
          aria-describedby={
            state.fields?.email ? "confirmation-email-error" : undefined
          }
        />
        {state.fields?.email && (
          <p id="confirmation-email-error" role="alert" className="auth-error">
            {state.fields.email}
          </p>
        )}
        <AuthTurnstile />
        <button
          type="submit"
          className="primary yk-auth-submit"
          disabled={pending || waiting}
          aria-busy={pending}
        >
          {pending
            ? "Sending request…"
            : waiting
              ? `Resend in ${remaining} ${remaining === 1 ? "second" : "seconds"}`
              : "Resend confirmation"}
        </button>
      </fieldset>
    </form>
  );
}
