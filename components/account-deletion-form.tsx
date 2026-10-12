"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  deleteAccountAction,
  reconnectForDeletion
} from "@/app/parametres/actions";

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
        Supprimer mon compte
      </h2>
      <p
        id="delete-account-consequences"
        className="mt-3 text-sm leading-6 text-ink-2"
      >
        Cette suppression est définitive. Toutes tes cartes, tes Karas, ton
        avatar et tes données de profil seront effacés. Tes ventes en cours
        seront annulées et les enchérisseurs remboursés. Tes mises en tête
        seront remboursées puis retirées ; les enchères des autres joueurs
        continueront. Tes échanges en attente seront annulés. Les historiques
        conservés afficheront « Joueur supprimé ».
      </p>
      <p className="mt-3 text-sm leading-6 text-ink-2">
        Pour protéger ton compte, une connexion de moins de cinq minutes est
        nécessaire.
      </p>
      <form action={action} className="mt-6 grid gap-4" aria-busy={pending}>
        <fieldset
          disabled={pending || Boolean(state.reconnect)}
          className="grid gap-4"
        >
          <label htmlFor="delete-account-pseudo" className="yk-field-label">
            Retape ton pseudo : {pseudo}
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
            {pending
              ? "Suppression en cours…"
              : "Supprimer définitivement mon compte"}
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
            {reconnecting ? "Déconnexion…" : "Me reconnecter"}
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
