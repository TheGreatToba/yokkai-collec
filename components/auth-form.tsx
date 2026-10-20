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
import {
  PSEUDO_NO_EMOJI_PATTERN,
  pseudoValidationError,
  SIGNUP_POLICY_VERSION,
  type AuthState
} from "@/lib/auth/forms";

type PseudoAvailability = "idle" | "checking" | "available" | "taken";

export function AuthForm({
  mode,
  referralCode,
  confirmationError = false,
  confirmationUnavailable = false,
  checkPseudoAvailability = checkPseudoAvailabilityWhileTyping
}: {
  mode: "signin" | "signup";
  referralCode?: string;
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
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const pseudoError =
    (signup && pseudo ? pseudoValidationError(pseudo.trim()) : undefined) ||
    (pseudo.trim() === state.values?.pseudo ? state.fields?.pseudo : undefined);
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
              If this email address can be used to create an account,
              you&apos;ll receive a confirmation link. Check your spam folder
              too. If you already have an account, you can sign in.
            </p>
          </div>
        </div>
        <ConfirmationResendForm
          email={state.values?.email}
          initialDelay={state.retryAfter}
        />
        <Link href="/login" className="yk-auth-link">
          Sign in →
        </Link>
      </div>
    );

  return (
    <>
      <form action={action} className="yk-auth-form" aria-busy={pending}>
        {signup && referralCode && (
          <>
            <input type="hidden" name="referralCode" value={referralCode} />
            <p role="status" className="yk-auth-success-panel text-sm">
              Referral invitation applied. Your friend will receive 5 bonus
              Regular Packs after you verify your email.
            </p>
          </>
        )}
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
                pattern={PSEUDO_NO_EMOJI_PATTERN}
                title="Choose a username without emoji."
                value={pseudo}
                onChange={event => {
                  pseudoRequest.current += 1;
                  setPseudo(event.target.value);
                  setPseudoAvailability("idle");
                  event.currentTarget.setCustomValidity(
                    pseudoValidationError(event.currentTarget.value.trim()) ??
                      ""
                  );
                }}
                className="auth-input"
                placeholder="Your collector name"
                aria-invalid={Boolean(pseudoError)}
                aria-describedby={
                  pseudoError
                    ? "pseudo-error"
                    : pseudoAvailability !== "idle"
                      ? "pseudo-availability"
                      : "pseudo-help"
                }
              />
              {!pseudoError && pseudoAvailability === "idle" && (
                <p id="pseudo-help" className="mt-2 text-xs text-white/50">
                  3–30 characters. Spaces between characters and accents are
                  allowed. No emoji.
                </p>
              )}
              {!pseudoError && pseudoAvailability !== "idle" && (
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
              {pseudoError && (
                <p
                  id="pseudo-error"
                  className="mt-2 text-sm text-red-200"
                  role="alert"
                >
                  {pseudoError}
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
          {signup && (
            <div className="yk-auth-policy">
              <div className="yk-auth-policy-row">
                <input
                  id="accepted-policies"
                  name="acceptedPolicies"
                  type="checkbox"
                  value={SIGNUP_POLICY_VERSION}
                  required
                  checked={policiesAccepted}
                  onChange={event => setPoliciesAccepted(event.target.checked)}
                  aria-invalid={Boolean(state.fields?.acceptedPolicies)}
                  aria-describedby={
                    state.fields?.acceptedPolicies
                      ? "policy-draft-note policy-error"
                      : "policy-draft-note"
                  }
                />
                <label htmlFor="accepted-policies">
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="yk-auth-link"
                    aria-label="Terms of Use (opens in a new tab)"
                  >
                    Terms of Use
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/rules"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="yk-auth-link"
                    aria-label="Community rules (opens in a new tab)"
                  >
                    Community rules
                  </Link>
                  .
                </label>
              </div>
              <p id="policy-draft-note" className="yk-auth-policy-note">
                Preview only: the Terms are a draft awaiting legal review.
              </p>
              {state.fields?.acceptedPolicies && (
                <p id="policy-error" className="auth-error" role="alert">
                  {state.fields.acceptedPolicies}
                </p>
              )}
            </div>
          )}
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
          <Link href={signup ? "/login" : "/signup"} className="yk-auth-link">
            {signup ? "Sign in" : "Join the hunt"}
          </Link>
        </p>
        {!signup && (
          <p className="yk-auth-switch">
            <Link href="/forgot-password" className="yk-auth-link">
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
