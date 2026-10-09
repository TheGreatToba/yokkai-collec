"use client";

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { reportCard, type CardReportReason } from "@/lib/data/card-reports";
import { Button, Feedback, Modal } from "@/components/ui";

const reasons: { value: CardReportReason; label: string }[] = [
  { value: "image_issue", label: "Problème d’image" },
  { value: "wrong_license", label: "La licence n’est pas la bonne" },
  { value: "duplicate_card", label: "Doublon de carte" },
];

export function CardReportButton({ cardId, cardName }: { cardId: string; cardName: string }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CardReportReason | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => { const frame=requestAnimationFrame(()=>setMounted(true)); return()=>cancelAnimationFrame(frame); }, []);

  const show = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    setError("");
    setSent(false);
  };
  const close = () => { if (!busy) setOpen(false); };
  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError("");
    try {
      await reportCard(cardId, reason);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le signalement n’a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <span
      className="yk-card-report-trigger"
      role="button"
      tabIndex={0}
      aria-label={`Signaler la carte ${cardName}`}
      title="Signaler cette carte"
      onClick={show}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") show(event); }}
    ><span aria-hidden="true">⚑</span><span>Signaler</span></span>
    {mounted && open && createPortal(
      <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <Modal open={open} onClose={close} title="Signaler cette carte" className="yk-card-report-modal">
          {sent ? <><Feedback tone="success" title="Signalement envoyé">L’équipe pourra vérifier {cardName} depuis le panneau admin.</Feedback><div className="mt-6 flex justify-end"><Button onClick={close}>Fermer</Button></div></> : <>
            <p className="text-sm text-ink-2">Quel problème as-tu remarqué sur <strong className="text-ink">{cardName}</strong> ?</p>
            <fieldset className="mt-5 space-y-3"><legend className="sr-only">Raison du signalement</legend>{reasons.map(item => <label className={`yk-card-report-reason ${reason === item.value ? "is-selected" : ""}`} key={item.value}><input type="radio" name={`card-report-${cardId}`} value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)}/><span>{item.label}</span></label>)}</fieldset>
            {error && <p className="mt-4 text-sm text-danger-ink" role="alert">{error}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={close}>Annuler</Button><Button variant="danger" disabled={!reason || busy} onClick={() => void submit()}>{busy ? "Envoi…" : "Envoyer le signalement"}</Button></div>
          </>}
        </Modal>
      </div>, document.body)}
  </>;
}
