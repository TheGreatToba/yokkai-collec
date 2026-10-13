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
        Si cette adresse correspond à un compte à confirmer, tu recevras un
        nouveau lien. Vérifie aussi les courriers indésirables.
      </p>
      {state.success && (
        <p role="status" className="yk-auth-notice">
          Si une confirmation est nécessaire, un e-mail te sera envoyé. Si ton
          compte est déjà confirmé, tu peux te connecter.
        </p>
      )}
      {state.error && (
        <p role="alert" className="auth-error">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">Renvoyer la confirmation d’e-mail</legend>
        <label htmlFor="confirmation-email" className="auth-label">
          Adresse e-mail à confirmer
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
            ? "Envoi de la demande…"
            : waiting
              ? "Renvoyer dans " + remaining + " s"
              : "Renvoyer la confirmation"}
        </button>
      </fieldset>
    </form>
  );
}
