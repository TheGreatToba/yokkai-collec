"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { reportCard, type CardReportReason } from "@/lib/data/card-reports";
import { Button, Feedback, Modal } from "@/components/ui";

const reasons: { value: CardReportReason; label: string }[] = [
  { value: "image_issue", label: "Image issue" },
  { value: "wrong_license", label: "Incorrect franchise" },
  { value: "duplicate_card", label: "Duplicate card" }
];

export function CardReportButton({
  cardId,
  cardName,
  sendReport = reportCard,
  className = ""
}: {
  cardId: string;
  cardName: string;
  sendReport?: typeof reportCard;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CardReportReason | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const show = () => {
    setOpen(true);
    setError("");
    setSent(false);
  };
  const close = () => {
    if (!busy) setOpen(false);
  };
  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError("");
    try {
      await sendReport(cardId, reason);
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't send this report."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="danger"
        className={className}
        aria-label={`Report ${cardName}`}
        title="Report this card"
        onClick={show}
      >
        <span aria-hidden="true">⚑</span> Report this card
      </Button>
      {mounted &&
        open &&
        createPortal(
          <div
            onClick={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
          >
            <Modal
              open={open}
              onClose={close}
              title="Report this card"
              className="yk-card-report-modal"
            >
              {sent ? (
                <>
                  <Feedback tone="success" title="Report sent">
                    The team can review {cardName} in the admin panel.
                  </Feedback>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={close}>Close</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-2">
                    What issue did you notice with{" "}
                    <strong className="text-ink">{cardName}</strong>?
                  </p>
                  <fieldset className="mt-5 space-y-3">
                    <legend className="sr-only">Report reason</legend>
                    {reasons.map(item => (
                      <label
                        className={`yk-card-report-reason ${reason === item.value ? "is-selected" : ""}`}
                        key={item.value}
                      >
                        <input
                          type="radio"
                          name={`card-report-${cardId}`}
                          value={item.value}
                          checked={reason === item.value}
                          onChange={() => setReason(item.value)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </fieldset>
                  {error && (
                    <p className="mt-4 text-sm text-danger-ink" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <Button variant="secondary" disabled={busy} onClick={close}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!reason || busy}
                      onClick={() => void submit()}
                    >
                      {busy ? "Sending…" : "Send report"}
                    </Button>
                  </div>
                </>
              )}
            </Modal>
          </div>,
          document.body
        )}
    </>
  );
}
