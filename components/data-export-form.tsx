"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { reconnectForDeletion } from "@/app/parametres/actions";

export function DataExportForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [reconnect, setReconnect] = useState(false);
  const [reconnectState, reconnectAction, reconnecting] = useActionState(
    reconnectForDeletion,
    {}
  );

  async function download() {
    setPending(true);
    setError(false);
    setMessage("Préparation de tes données…");
    try {
      const response = await fetch("/api/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) {
        const problem = await response.json();
        setReconnect(problem.reconnect === true);
        const next =
          typeof problem.retryAfter === "number"
            ? ` Prochain téléchargement possible le ${new Date(Date.now() + problem.retryAfter * 1000).toLocaleString("fr-FR")}.`
            : "";
        throw new Error(
          (typeof problem.error === "string"
            ? problem.error
            : "Le téléchargement a échoué.") + next
        );
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="(mes-donnees-\d{4}-\d{2}-\d{2}\.json)"/)?.[1] ??
        "mes-donnees.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage(
        "Téléchargement lancé. Un nouveau téléchargement sera possible dans 24 heures."
      );
    } catch (failure) {
      setError(true);
      setMessage(
        failure instanceof Error
          ? failure.message
          : "Le téléchargement a échoué. Réessaie plus tard."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="mes-donnees"
      aria-labelledby="data-export-title"
      className="mt-6 rounded-panel border border-border bg-surface p-6"
    >
      <h2 id="data-export-title" className="font-display text-xl">
        Mes données
      </h2>
      <p className="mt-3 text-sm leading-6 text-ink-2">
        Télécharge tes données de compte et de jeu dans un fichier JSON. Les
        avatars sont décrits sans leur image. Une connexion de moins de cinq
        minutes est nécessaire. Un téléchargement est possible toutes les 24
        heures.
      </p>
      <div className="mt-6" aria-busy={pending}>
        <Button
          type="button"
          onClick={download}
          disabled={pending || reconnect}
        >
          {pending ? "Préparation en cours…" : "Télécharger mes données"}
        </Button>
      </div>
      <p
        role={error ? "alert" : "status"}
        className={`mt-3 text-sm ${error ? "text-danger" : "text-ink-2"}`}
      >
        {message}
      </p>
      {reconnect && (
        <form action={reconnectAction} className="mt-3">
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
