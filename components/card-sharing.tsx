"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@/components/ui";
import {
  cardShareUrl,
  createCardShare,
  deleteCardShare,
  listCardShares,
  type CardShare
} from "@/lib/data/card-shares";

const previewWarning =
  "Les aperçus déjà publiés sur Discord, WhatsApp ou X peuvent rester visibles après la suppression du lien.";

export function CardShareButton({
  instanceId,
  name
}: {
  instanceId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Partager
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Partager ${name}`}
      >
        {open && (
          <ShareSheet key={instanceId} instanceId={instanceId} name={name} />
        )}
      </Modal>
    </>
  );
}

function ShareSheet({
  instanceId,
  name
}: {
  instanceId: string;
  name: string;
}) {
  const [showPseudo, setShowPseudo] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const nativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(
          reason instanceof Error ? reason.message : "Action indisponible."
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function download(format: "story" | "square") {
    const response = await fetch(`${url}/image/${format}`, {
      cache: "no-store"
    });
    if (!response.ok || response.headers.get("Content-Type") !== "image/png") {
      throw new Error("L’image est indisponible. Réessaie dans un instant.");
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `yokkai-${format}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-2">
        L’image affichée sur ta carte sera publiée, y compris ton image
        personnalisée si tu en as une. Un lien existant sera actualisé avec
        cette image. Maximum 10 nouvelles créations par jour UTC.
      </p>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={showPseudo}
          disabled={busy}
          onChange={event => {
            setShowPseudo(event.target.checked);
            setUrl("");
            setMessage("");
          }}
        />
        Afficher mon pseudo
      </label>
      {!url ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () =>
              setUrl(
                cardShareUrl(await createCardShare(instanceId, showPseudo))
              )
            )
          }
        >
          {busy ? "Création…" : "Créer le lien"}
        </Button>
      ) : (
        <>
          <label className="block text-sm">
            Lien public
            <input
              className="auth-input mt-2"
              readOnly
              value={url}
              onFocus={event => event.currentTarget.select()}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(url);
                  setMessage("Lien copié");
                })
              }
            >
              Copier le lien
            </Button>
            {nativeShare && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await navigator.share({ title: name, url });
                  })
                }
              >
                Partager le lien
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => download("story"))}
            >
              Télécharger la story
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => download("square"))}
            >
              Télécharger le carré
            </Button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="text-sm text-ink-2">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-3">{previewWarning}</p>
    </div>
  );
}

export function MyCardShares() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Mes liens partagés
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mes liens partagés"
      >
        {open && <ShareList />}
      </Modal>
    </>
  );
}

function ShareList() {
  const [rows, setRows] = useState<CardShare[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState<CardShare | null>(null);
  const [deleting, setDeleting] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void listCardShares(offset).then(
      value => {
        if (active) {
          setRows(value);
          setLoading(false);
        }
      },
      reason => {
        if (active) {
          setError(reason.message);
          setLoading(false);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [offset, revision]);
  function page(value: number) {
    setLoading(true);
    setError("");
    setOffset(value);
  }
  async function remove() {
    if (!candidate || lock.current) return;
    lock.current = true;
    setDeleting(true);
    setError("");
    try {
      await deleteCardShare(candidate.id);
      setRows(current => current.filter(row => row.id !== candidate.id));
      setCandidate(null);
      setLoading(true);
      setRevision(value => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Suppression indisponible."
      );
    } finally {
      lock.current = false;
      setDeleting(false);
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-3">{previewWarning}</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Chargement…</p>
      ) : rows.length ? (
        <ul className="space-y-4">
          {rows.map(row => (
            <li key={row.id} className="rounded-panel border border-veil p-4">
              <a
                href={cardShareUrl(row.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-gold"
              >
                {row.cardName} · {row.rarity}
                {row.shiny ? " Shiny" : ""}
              </a>
              <p className="my-2 text-xs text-ink-3">
                {row.showPseudo ? "Pseudo affiché" : "Sans pseudo"} ·{" "}
                {new Date(row.createdAt).toLocaleDateString("fr-FR")}
              </p>
              <Button variant="danger" onClick={() => setCandidate(row)}>
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucun lien partagé sur cette page.</p>
      )}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          disabled={loading || offset === 0}
          onClick={() => page(Math.max(0, offset - 50))}
        >
          Précédente
        </Button>
        <Button
          variant="secondary"
          disabled={loading || rows.length < 50}
          onClick={() => page(offset + 50)}
        >
          Suivante
        </Button>
      </div>
      <Modal
        open={!!candidate}
        onClose={() => {
          if (!deleting) setCandidate(null);
        }}
        title="Supprimer ce lien ?"
      >
        <p className="text-sm text-ink-2">
          Le lien de {candidate?.cardName} ne sera plus accessible.{" "}
          {previewWarning}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <Button
            variant="secondary"
            disabled={deleting}
            onClick={() => setCandidate(null)}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={() => void remove()}
          >
            {deleting ? "Suppression…" : "Confirmer la suppression"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
