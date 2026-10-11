"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordReset,
  updateRecoveredPassword
} from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/forms";

export function PasswordResetRequestForm({
  invalidLink = false
}: {
  invalidLink?: boolean;
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
            <h2>Vérifie ta boîte mail</h2>
            <p>
              Si un compte correspond à cette adresse, un lien de
              réinitialisation vient d’être envoyé. Pense aussi aux courriers
              indésirables.
            </p>
          </div>
        </div>
        <Link href="/connexion" className="yk-auth-link">
          Retour à la connexion →
        </Link>
      </div>
    );

  return (
    <form action={action} className="yk-auth-form" aria-busy={pending}>
      {invalidLink && (
        <p role="alert" className="auth-error">
          Ce lien de réinitialisation est invalide ou a expiré. Demande un
          nouveau lien.
        </p>
      )}
      {state.error && (
        <p role="alert" className="auth-error">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">
          Recevoir un lien de réinitialisation
        </legend>
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
            placeholder="vous@exemple.fr"
            aria-invalid={Boolean(state.fields?.email)}
            aria-describedby={state.fields?.email ? "email-error" : undefined}
          />
          {state.fields?.email && (
            <p id="email-error" role="alert">
              {state.fields.email}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="primary yk-auth-submit"
        >
          {pending ? "Envoi du lien…" : "Envoyer le lien"}
        </button>
      </fieldset>
      <p className="yk-auth-switch">
        <Link href="/connexion" className="yk-auth-link">
          Retour à la connexion
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
        <legend className="sr-only">Choisir un nouveau mot de passe</legend>
        <div>
          <label htmlFor="password" className="auth-label">
            Nouveau mot de passe
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
            8 caractères minimum.
          </p>
          {state.fields?.password && (
            <p id="password-error" role="alert">
              {state.fields.password}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="auth-label">
            Confirmer le mot de passe
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
          {pending ? "Mise à jour…" : "Enregistrer le nouveau mot de passe"}
        </button>
      </fieldset>
    </form>
  );
}
