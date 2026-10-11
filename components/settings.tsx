"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Toast } from "@/components/ui";
import { getProfilePrivacy, setProfilePrivacy } from "@/lib/data/settings";
import { changePassword } from "@/app/auth/actions";

function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);
  return (
    <form
      ref={formRef}
      action={action}
      className="mt-6 grid gap-4"
      aria-busy={pending}
    >
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-success">
          Ton mot de passe a bien été modifié.
        </p>
      )}
      <fieldset disabled={pending} className="grid gap-4">
        <label className="block" htmlFor="currentPassword">
          <span className="yk-field-label">Mot de passe actuel</span>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            className="yk-field-control"
            aria-invalid={Boolean(state.fields?.currentPassword)}
            aria-describedby={
              state.fields?.currentPassword
                ? "current-password-error"
                : undefined
            }
          />
          {state.fields?.currentPassword && (
            <span
              id="current-password-error"
              role="alert"
              className="yk-field-help yk-field-error"
            >
              {state.fields.currentPassword}
            </span>
          )}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block" htmlFor="newPassword">
            <span className="yk-field-label">Nouveau mot de passe</span>
            <input
              id="newPassword"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className="yk-field-control"
              aria-invalid={Boolean(state.fields?.password)}
              aria-describedby={
                state.fields?.password ? "new-password-error" : undefined
              }
            />
            {state.fields?.password && (
              <span
                id="new-password-error"
                role="alert"
                className="yk-field-help yk-field-error"
              >
                {state.fields.password}
              </span>
            )}
          </label>
          <label className="block" htmlFor="confirmPassword">
            <span className="yk-field-label">
              Confirmer le nouveau mot de passe
            </span>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className="yk-field-control"
              aria-invalid={Boolean(state.fields?.confirmPassword)}
              aria-describedby={
                state.fields?.confirmPassword
                  ? "confirm-password-settings-error"
                  : undefined
              }
            />
            {state.fields?.confirmPassword && (
              <span
                id="confirm-password-settings-error"
                role="alert"
                className="yk-field-help yk-field-error"
              >
                {state.fields.confirmPassword}
              </span>
            )}
          </label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Modification…" : "Changer mon mot de passe"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function SettingsPanel() {
  const [isPublic, setIsPublic] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    void getProfilePrivacy().then(setIsPublic, reason =>
      setError(
        reason instanceof Error ? reason.message : "Chargement impossible."
      )
    );
  }, []);
  async function save() {
    if (isPublic === undefined) return;
    setBusy(true);
    setError("");
    try {
      setIsPublic(await setProfilePrivacy(isPublic));
      setToast("Confidentialité mise à jour");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Enregistrement impossible."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6">
      <section className="rounded-panel border border-veil bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl">Confidentialité du profil</h2>
            <p className="mt-3 text-sm leading-6 text-ink-2">
              Choisis qui peut voir ta collection et découvrir les cartes que tu
              possèdes dans le catalogue.
            </p>
            <p className="mt-3 text-xs leading-5 text-ink-3">
              En activant « Profil privé », seuls tes amis voient ta collection.
              Pour tous les autres, tu disparais de la liste des possesseurs et
              tes exemplaires ne sont pas comptabilisés.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label={
              isPublic === false
                ? "Rendre le profil public"
                : "Rendre le profil privé"
            }
            aria-checked={isPublic === undefined ? false : !isPublic}
            disabled={isPublic === undefined || busy}
            className="yk-shiny-toggle"
            onClick={() => setIsPublic(value => !value)}
          >
            <span>
              {isPublic === undefined
                ? "Chargement…"
                : isPublic
                  ? "Profil public"
                  : "Profil privé"}
            </span>
            <i aria-hidden="true" />
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end">
          <Button
            disabled={isPublic === undefined || busy}
            onClick={() => void save()}
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
        <Toast message={toast} onDismiss={() => setToast("")} />
      </section>
      <section className="rounded-panel border border-veil bg-surface p-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl">Mot de passe</h2>
          <p className="mt-3 text-sm leading-6 text-ink-2">
            Confirme ton mot de passe actuel, puis choisis-en un nouveau.
          </p>
        </div>
        <PasswordChangeForm />
      </section>
    </div>
  );
}
