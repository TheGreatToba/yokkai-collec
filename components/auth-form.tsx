"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/forms";

export function AuthForm({ mode, confirmationError = false }: {
  mode: "signin" | "signup"; confirmationError?: boolean;
}) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUp : signIn, {});
  if (state.success) return <div role="status" className="yk-auth-success">
    <div className="yk-auth-success-panel">
      <span className="yk-auth-success-icon" aria-hidden="true">✓</span>
      <div><h2>Vérifie ta boîte mail</h2>
      <p>Si cette adresse permet une nouvelle inscription, tu recevras un lien de confirmation. Pense aussi aux courriers indésirables. Si tu as déjà un compte, tu peux te connecter directement.</p></div>
    </div>
    <Link href="/connexion" className="yk-auth-link">Se connecter →</Link>
  </div>;

  return <form action={action} className="yk-auth-form" aria-busy={pending}>
    {confirmationError && <p role="alert" className="auth-error">Ce lien de confirmation est invalide ou a expiré. Si votre adresse est déjà confirmée, connectez-vous. Sinon, recommencez l’inscription pour recevoir un nouveau lien.</p>}
    {state.error && <p role="alert" className="auth-error">{state.error}</p>}
    <fieldset disabled={pending}>
      <legend className="sr-only">{signup ? "Créer un compte" : "Se connecter"}</legend>
      {signup && <div>
        <label htmlFor="pseudo" className="auth-label">Pseudo</label>
        <input id="pseudo" name="pseudo" autoComplete="nickname" required
          defaultValue={state.values?.pseudo} className="auth-input" placeholder="Votre nom de collectionneur"
          aria-invalid={Boolean(state.fields?.pseudo)} aria-describedby={state.fields?.pseudo ? "pseudo-error" : "pseudo-help"} />
        {!state.fields?.pseudo && <p id="pseudo-help" className="mt-2 text-xs text-white/50">3 à 30 caractères. Espaces internes, accents et emoji autorisés.</p>}
        {state.fields?.pseudo && <p id="pseudo-error" className="mt-2 text-sm text-red-200" role="alert">{state.fields.pseudo}</p>}
      </div>}
      <div>
        <label htmlFor="email" className="auth-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254}
          defaultValue={state.values?.email} className="auth-input" placeholder="vous@exemple.fr"
          aria-invalid={Boolean(state.fields?.email)} aria-describedby={state.fields?.email ? "email-error" : undefined} />
        {state.fields?.email && <p id="email-error" className="mt-2 text-sm text-red-200" role="alert">{state.fields.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="auth-label">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"}
          required minLength={signup ? 8 : undefined} maxLength={signup ? 128 : undefined} className="auth-input"
          aria-invalid={Boolean(state.fields?.password)} aria-describedby={state.fields?.password ? "password-error" : signup ? "password-help" : undefined} />
        {signup && <p id="password-help" className="mt-2 text-xs text-white/50">8 caractères minimum.</p>}
        {state.fields?.password && <p id="password-error" className="mt-2 text-sm text-red-200" role="alert">{state.fields.password}</p>}
      </div>
      <button type="submit" disabled={pending} aria-busy={pending} className="primary yk-auth-submit">
        {pending ? signup ? "Création du compte…" : "Connexion…" : signup ? "Créer mon compte" : "Se connecter"}
      </button>
    </fieldset>
    <p className="yk-auth-switch">
      {signup ? "Déjà un compte ? " : "Pas encore de compte ? "}
      <Link href={signup ? "/connexion" : "/inscription"} className="yk-auth-link">
        {signup ? "Se connecter" : "Rejoindre la chasse"}
      </Link>
    </p>
  </form>;
}
