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
    setMessage("Preparing your data…");
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
            ? ` You can download your data again on ${new Date(Date.now() + problem.retryAfter * 1000).toLocaleString("en-US")}.`
            : "";
        throw new Error(
          (typeof problem.error === "string"
            ? problem.error
            : "Download failed.") + next
        );
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="(my-data-\d{4}-\d{2}-\d{2}\.json)"/)?.[1] ??
        "my-data.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage(
        "Download started. You can download your data again in 24 hours."
      );
    } catch (failure) {
      setError(true);
      setMessage(
        failure instanceof Error
          ? failure.message
          : "Download failed. Please try again later."
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
        My data
      </h2>
      <p className="mt-3 text-sm leading-6 text-ink-2">
        Download your account and game data as a JSON file. Avatar details are
        included, but image files aren't. You must have signed in within the
        last five minutes. You can download your data once every 24 hours.
      </p>
      <div className="mt-6" aria-busy={pending}>
        <Button
          type="button"
          onClick={download}
          disabled={pending || reconnect}
        >
          {pending ? "Preparing…" : "Download my data"}
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
            {reconnecting ? "Signing out…" : "Sign in again"}
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
