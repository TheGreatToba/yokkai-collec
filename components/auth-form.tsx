"use client";

import { AuthTurnstile } from "@/components/auth-turnstile";

import Link from "next/link";
import { ConfirmationResendForm } from "@/components/confirmation-resend-form";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  checkPseudoAvailabilityWhileTyping,
  signIn,
  signUp
} from "@/app/auth/actions";
import { pseudoValidationError, type AuthState } from "@/lib/auth/forms";

type PseudoAvailability = "idle" | "checking" | "available" | "taken";

export function AuthForm({
  mode,
  confirmationError = false,
  confirmationUnavailable = false,
  checkPseudoAvailability = checkPseudoAvailabilityWhileTyping
}: {
  mode: "signin" | "signup";
  confirmationError?: boolean;
  confirmationUnavailable?: boolean;
  checkPseudoAvailability?: (pseudo: string) => Promise<boolean | undefined>;
}) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup ? signUp : signIn,
    {}
  );
  const [pseudo, setPseudo] = useState(state.values?.pseudo ?? "");
  const [pseudoAvailability, setPseudoAvailability] =
    useState<PseudoAvailability>("idle");
  const pseudoRequest = useRef(0);
  useEffect(() => {
    if (!signup || pseudoValidationError(pseudo.trim())) return;
    const request = pseudoRequest.current;
    const timeout = window.setTimeout(async () => {
      setPseudoAvailability("checking");
      const available = await checkPseudoAvailability(pseudo.trim());
      if (pseudoRequest.current !== request) return;
      setPseudoAvailability(
        available === true
          ? "available"
          : available === false
            ? "taken"
            : "idle"
      );
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [checkPseudoAvailability, pseudo, signup]);
  if (state.success)
    return (
      <div className="yk-auth-success">
        <div role="status" className="yk-auth-success-panel">
          <span className="yk-auth-success-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <h2>Check your inbox</h2>
            <p>
              If this email address can be used to create an account, you'll
              receive a confirmation link. Check your spam folder too. If you
              already have an account, you can sign in.
            </p>
          </div>
        </div>
        <ConfirmationResendForm
          email={state.values?.email}
          initialDelay={state.retryAfter}
        />
        <Link href="/connexion" className="yk-auth-link">
          Sign in →
        </Link>
      </div>
    );

  return (
    <>
      <form action={action} className="yk-auth-form" aria-busy={pending}>
        {confirmationError && (
          <p role="alert" className="auth-error">
            This confirmation link is invalid, expired, or already used. If your
            email is already confirmed, sign in. Otherwise, request a new link
            below.
          </p>
        )}
        {confirmationUnavailable && (
          <p role="alert" className="auth-error">
            Email confirmation is temporarily unavailable. Try your link again
            in a moment.
          </p>
        )}
        {state.error && (
          <p role="alert" className="auth-error">
            {state.error}
          </p>
        )}
        <fieldset disabled={pending}>
          <legend className="sr-only">
            {signup ? "Create an account" : "Sign in"}
          </legend>
          {signup && (
            <div>
              <label htmlFor="pseudo" className="auth-label">
                Username
              </label>
              <input
                id="pseudo"
                name="pseudo"
                autoComplete="nickname"
                required
                value={pseudo}
                onChange={event => {
                  pseudoRequest.current += 1;
                  setPseudo(event.target.value);
                  setPseudoAvailability("idle");
                }}
                className="auth-input"
                placeholder="Your collector name"
                aria-invalid={Boolean(state.fields?.pseudo)}
                aria-describedby={
                  state.fields?.pseudo
                    ? "pseudo-error"
                    : pseudoAvailability !== "idle"
                      ? "pseudo-availability"
                      : "pseudo-help"
                }
              />
              {!state.fields?.pseudo && pseudoAvailability === "idle" && (
                <p id="pseudo-help" className="mt-2 text-xs text-white/50">
                  3–30 characters. Spaces between characters, accents, and emoji
                  are allowed.
                </p>
              )}
              {!state.fields?.pseudo && pseudoAvailability !== "idle" && (
                <p
                  id="pseudo-availability"
                  className={`mt-2 text-xs ${pseudoAvailability === "available" ? "text-lime-300" : pseudoAvailability === "taken" ? "text-red-200" : "text-white/50"}`}
                  role="status"
                >
                  {pseudoAvailability === "checking"
                    ? "Checking…"
                    : pseudoAvailability === "available"
                      ? "Available"
                      : "Already taken"}
                </p>
              )}
              {state.fields?.pseudo && (
                <p
                  id="pseudo-error"
                  className="mt-2 text-sm text-red-200"
                  role="alert"
                >
                  {state.fields.pseudo}
                </p>
              )}
            </div>
          )}
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
              <p
                id="email-error"
                className="mt-2 text-sm text-red-200"
                role="alert"
              >
                {state.fields.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="auth-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 8 : undefined}
              maxLength={signup ? 128 : undefined}
              className="auth-input"
              aria-invalid={Boolean(state.fields?.password)}
              aria-describedby={
                state.fields?.password
                  ? "password-error"
                  : signup
                    ? "password-help"
                    : undefined
              }
            />
            {signup && (
              <p id="password-help" className="mt-2 text-xs text-white/50">
                At least 8 characters.
              </p>
            )}
            {state.fields?.password && (
              <p
                id="password-error"
                className="mt-2 text-sm text-red-200"
                role="alert"
              >
                {state.fields.password}
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
            {pending
              ? signup
                ? "Creating account…"
                : "Signing in…"
              : signup
                ? "Create my account"
                : "Sign in"}
          </button>
        </fieldset>
        <p className="yk-auth-switch">
          {signup ? "Already have an account? " : "New here? "}
          <Link
            href={signup ? "/connexion" : "/inscription"}
            className="yk-auth-link"
          >
            {signup ? "Sign in" : "Join the hunt"}
          </Link>
        </p>
        {!signup && (
          <p className="yk-auth-switch">
            <Link href="/mot-de-passe-oublie" className="yk-auth-link">
              Forgot password?
            </Link>
          </p>
        )}
      </form>
      {!signup && (
        <details
          className="yk-auth-switch"
          open={confirmationError || undefined}
        >
          <summary className="yk-auth-link">Resend confirmation link</summary>
          <ConfirmationResendForm email={state.values?.email} />
        </details>
      )}
    </>
  );
}
