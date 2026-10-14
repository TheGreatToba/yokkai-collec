"use client";

import { AuthTurnstile } from "@/components/auth-turnstile";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordReset,
  updateRecoveredPassword
} from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/forms";

export function PasswordResetRequestForm({
  invalidLink = false,
  confirmationUnavailable = false
}: {
  invalidLink?: boolean;
  confirmationUnavailable?: boolean;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {}
  );
  if (state.success)
    return (
      <div role="status" className="yk-auth-success">
        <div className="yk-auth-success-panel">
          <span className="yk-auth-success-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <h2>Check your inbox</h2>
            <p>
              If an account matches this email address, you&apos;ll receive a
              password reset link. Check your spam folder too.
            </p>
          </div>
        </div>
        <Link href="/connexion" className="yk-auth-link">
          Back to sign in →
        </Link>
      </div>
    );

  return (
    <form action={action} className="yk-auth-form" aria-busy={pending}>
      {invalidLink && (
        <p role="alert" className="auth-error">
          This password reset link is invalid, expired, or already used. Request
          a new link.
        </p>
      )}
      {confirmationUnavailable && (
        <p role="alert" className="auth-error">
          Link verification is temporarily unavailable. Try your link again in a
          moment.
        </p>
      )}
      {state.error && (
        <p role="alert" className="auth-error">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">Request a password reset link</legend>
        <div>
          <label htmlFor="email" className="auth-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={state.values?.email}
            className="auth-input"
            placeholder="you@example.com"
            aria-invalid={Boolean(state.fields?.email)}
            aria-describedby={state.fields?.email ? "email-error" : undefined}
          />
          {state.fields?.email && (
            <p id="email-error" role="alert">
              {state.fields.email}
            </p>
          )}
        </div>
        <AuthTurnstile />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="primary yk-auth-submit"
        >
          {pending ? "Sending link…" : "Send link"}
        </button>
      </fieldset>
      <p className="yk-auth-switch">
        <Link href="/connexion" className="yk-auth-link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function PasswordUpdateForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updateRecoveredPassword,
    {}
  );
  return (
    <form action={action} className="yk-auth-form" aria-busy={pending}>
      {state.error && (
        <p role="alert" className="auth-error">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">Choose a new password</legend>
        <div>
          <label htmlFor="password" className="auth-label">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className="auth-input"
            aria-invalid={Boolean(state.fields?.password)}
            aria-describedby={
              state.fields?.password
                ? "password-help password-error"
                : "password-help"
            }
          />
          <p id="password-help" className="mt-2 text-xs text-white/50">
            At least 8 characters.
          </p>
          {state.fields?.password && (
            <p id="password-error" role="alert">
              {state.fields.password}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="auth-label">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className="auth-input"
            aria-invalid={Boolean(state.fields?.confirmPassword)}
            aria-describedby={
              state.fields?.confirmPassword
                ? "confirm-password-error"
                : undefined
            }
          />
          {state.fields?.confirmPassword && (
            <p id="confirm-password-error" role="alert">
              {state.fields.confirmPassword}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="primary yk-auth-submit"
        >
          {pending ? "Updating…" : "Save new password"}
        </button>
      </fieldset>
    </form>
  );
}
