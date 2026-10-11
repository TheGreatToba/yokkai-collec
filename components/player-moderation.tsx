"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import {
  liveModeration,
  type ModerationAdapter,
  type ReportReason
} from "@/lib/data/moderation";

const reasons: [ReportReason, string][] = [
  ["harassment", "Harcèlement ou insultes"],
  ["inappropriate", "Contenu inapproprié, image ou GIF"],
  ["spam", "Spam"],
  ["cheating", "Triche ou faux comptes"],
  ["other", "Autre"]
];
export function PlayerModeration({
  userId,
  pseudo,
  blockedByMe = false,
  contextId,
  onBlocked,
  onReported,
  adapter = liveModeration
}: {
  userId: string;
  pseudo: string;
  blockedByMe?: boolean;
  contextId?: string;
  onBlocked?: () => void;
  onReported?: () => void;
  adapter?: ModerationAdapter;
}) {
  const [sheet, setSheet] = useState<"block" | "report" | null>(null);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [details, setDetails] = useState("");
  const [blockAlso, setBlockAlso] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  function open(next: "block" | "report") {
    setError("");
    setSuccess("");
    setDetails("");
    setBlockAlso(false);
    setReason("harassment");
    setSheet(next);
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (sheet === "block") {
        await adapter.block(userId);
        onBlocked?.();
      } else {
        await adapter.report({
          userId,
          reason,
          contextType: contextId ? "auction_chat" : "profile",
          contextId,
          details,
          blockAlso
        });
        if (blockAlso) onBlocked?.();
        setSuccess("Merci, ton signalement a été transmis.");
        onReported?.();
      }
      setSheet(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible d’effectuer cette action."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="relative">
      {contextId ? (
        <button
          type="button"
          className="text-xs text-ink-3 underline hover:text-ink"
          aria-label={`Signaler le message de ${pseudo}`}
          onClick={() => open("report")}
        >
          Signaler
        </button>
      ) : (
        <details className="relative">
          <summary
            className="yk-button yk-button-secondary cursor-pointer"
            aria-label={`Actions pour ${pseudo}`}
          >
            ⋯
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex min-w-40 flex-col gap-2 rounded-panel border border-veil bg-surface p-3">
            {!blockedByMe && (
              <Button variant="danger" onClick={() => open("block")}>
                Bloquer
              </Button>
            )}
            <Button variant="secondary" onClick={() => open("report")}>
              Signaler
            </Button>
          </div>
        </details>
      )}
      {success && (
        <p className="mt-2 text-sm text-ink-2" role="status">
          {success}
        </p>
      )}
      <Modal
        open={sheet !== null}
        onClose={() => {
          if (!busy) setSheet(null);
        }}
        title={sheet === "block" ? `Bloquer ${pseudo} ?` : `Signaler ${pseudo}`}
        className="max-w-lg"
      >
        {sheet === "block" ? (
          <p className="text-sm leading-6 text-ink-2">
            Il sera retiré de tes amis et vos offres d’échange en attente seront
            annulées. Il ne sera pas prévenu.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              Motif
              <select
                className="auth-input mt-2"
                value={reason}
                disabled={busy}
                onChange={event =>
                  setReason(event.target.value as ReportReason)
                }
              >
                {reasons.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Détails facultatifs
              <textarea
                className="auth-input mt-2 min-h-28"
                maxLength={500}
                value={details}
                disabled={busy}
                onChange={event => setDetails(event.target.value)}
              />
              <span className="mt-1 block text-right text-xs text-ink-3">
                {details.length}/500
              </span>
            </label>
            {!blockedByMe && (
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={blockAlso}
                  disabled={busy}
                  onChange={event => setBlockAlso(event.target.checked)}
                />
                Bloquer aussi ce joueur
              </label>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger-ink">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setSheet(null)}
          >
            Annuler
          </Button>
          <Button
            variant={sheet === "block" ? "danger" : "primary"}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy
              ? "Envoi…"
              : sheet === "block"
                ? "Bloquer"
                : "Transmettre le signalement"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
