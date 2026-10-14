"use client";
/* eslint-disable @next/next/no-img-element -- private wall media and animated GIFs use authenticated URLs. */
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Modal, Toast } from "@/components/ui";
import { GifPicker } from "@/components/gif-picker";
import {
  liveWall,
  type WallAdapter,
  type WallPage,
  type WallPost
} from "@/lib/data/profile-wall";

export function ProfileWall({
  ownerId,
  pseudo,
  avatarUrl,
  isMe,
  isPublic,
  canRead,
  active,
  adapter = liveWall
}: {
  ownerId: string;
  pseudo: string;
  avatarUrl: string | null;
  isMe: boolean;
  isPublic: boolean;
  canRead: boolean;
  active: boolean;
  adapter?: WallAdapter;
}) {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [cursor, setCursor] = useState<WallPage["next"]>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [gif, setGif] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [removing, setRemoving] = useState<WallPost | null>(null);
  const [retry, setRetry] = useState(0);
  const [cleanup, setCleanup] = useState<string[]>([]);
  const requestId = useRef<string | null>(null);
  const lock = useRef(false);
  const uploaded = useRef<{ file: File; path: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );
  useEffect(() => {
    if (!active || !canRead) return;
    let current = true;
    void Promise.resolve()
      .then(() => {
        if (!current) return null;
        setLoading(true);
        setError("");
        return adapter.list(ownerId);
      })
      .then(
        page => {
          if (current && page) {
            setPosts(page.items);
            setCursor(page.next);
          }
        },
        () => {
          if (current) {
            setPosts([]);
            setCursor(null);
            setError("Impossible de charger le mur. Réessaie dans un instant.");
          }
        }
      )
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [active, canRead, ownerId, adapter, retry]);
  async function discard(path: string) {
    try {
      await adapter.discard(path);
    } catch {
      setCleanup(current => [...new Set([...current, path])]);
    }
  }
  function changeAttachment(next: File | null, nextGif = "") {
    if (lock.current) return;
    if (uploaded.current) {
      void discard(uploaded.current.path);
      uploaded.current = null;
    }
    requestId.current = null;
    setError("");
    if (
      next &&
      (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        next.type
      ) ||
        next.size > 6 * 1024 * 1024 ||
        !next.size)
    ) {
      setError("JPG, PNG, WebP ou GIF, 6 Mo maximum.");
      return;
    }
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
    setGif(nextGif);
    if (fileInput.current) fileInput.current.value = "";
  }
  async function publish() {
    if (
      lock.current ||
      loading ||
      !isMe ||
      !canRead ||
      (!text.trim() && !file && !gif)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      if (file && uploaded.current?.file !== file)
        uploaded.current = { file, path: await adapter.upload(file, ownerId) };
      const post = await adapter.publish({
        id: requestId.current,
        text: text.trim(),
        mediaPath: uploaded.current?.path ?? null,
        gifUrl: gif || null
      });
      setPosts(current => [
        post,
        ...current.filter(item => item.id !== post.id)
      ]);
      uploaded.current = null;
      requestId.current = null;
      setText("");
      setFile(null);
      setPreview("");
      setGif("");
      setToast("Publication ajoutée à ton mur");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Impossible de publier. Ton brouillon est conservé."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing || lock.current || loading || !isMe) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const path = await adapter.remove(removing.id);
      setPosts(current => current.filter(post => post.id !== removing.id));
      setRemoving(null);
      if (path) await discard(path);
      setToast("Publication supprimée");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Impossible de supprimer la publication."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function more() {
    if (loading || busy || !cursor) return;
    setLoading(true);
    setError("");
    try {
      const page = await adapter.list(ownerId, cursor);
      setPosts(current => [
        ...new Map(
          [...current, ...page.items].map(post => [post.id, post])
        ).values()
      ]);
      setCursor(page.next);
    } catch {
      setPosts([]);
      setCursor(null);
      setError("Le mur est indisponible ou son accès a changé. Réessaie.");
    } finally {
      setLoading(false);
    }
  }
  if (!canRead)
    return (
      <section className="yk-profile-surface yk-wall-private">
        <h2>Ce mur est privé</h2>
        <p>Seuls ses amis peuvent voir les publications.</p>
      </section>
    );
  return (
    <section className="yk-profile-wall">
      <div className="yk-profile-section-heading">
        <div>
          <p className="eyebrow">Ses publications</p>
          <h2>Le mur de {pseudo}</h2>
        </div>
        <span className="yk-wall-audience">
          {isPublic ? "Public · Tous les joueurs" : "Privé · Toi et tes amis"}
        </span>
      </div>
      {isMe && (
        <form
          className="yk-profile-surface yk-wall-composer"
          onSubmit={event => {
            event.preventDefault();
            void publish();
          }}
        >
          <div className="yk-wall-author">
            <Avatar name={pseudo} image={avatarUrl ?? undefined} size={38} />
            <strong>{pseudo}</strong>
          </div>
          <label htmlFor="wall-text" className="sr-only">
            Ta publication
          </label>
          <textarea
            id="wall-text"
            className="auth-input"
            value={text}
            maxLength={3000}
            disabled={busy}
            placeholder="Une découverte, une nouvelle carte, une pensée… raconte ce que tu veux."
            onChange={event => {
              setText(event.target.value);
              requestId.current = null;
            }}
          />
          {(preview || gif) && (
            <div className="yk-wall-attachment">
              <img src={preview || gif} alt="Aperçu de la pièce jointe" />
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => changeAttachment(null)}
              >
                Retirer la pièce jointe
              </Button>
            </div>
          )}
          <div className="yk-wall-compose-actions">
            <div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Ajouter une image
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Image pour le mur"
                hidden
                disabled={busy}
                onChange={event =>
                  changeAttachment(event.target.files?.[0] ?? null)
                }
              />
              <GifPicker
                disabled={busy}
                onSelect={choice => changeAttachment(null, choice.url)}
              />
            </div>
            <span>{text.length}/3000</span>
            <Button
              type="submit"
              disabled={busy || (!text.trim() && !file && !gif)}
            >
              {busy ? "Publication…" : "Publier"}
            </Button>
          </div>
          <p className="yk-profile-muted">
            Une image ou un GIF par publication · 6 Mo maximum. La visibilité
            suit celle de ton profil.
          </p>
        </form>
      )}
      {error && (
        <div role="alert" className="yk-profile-notice">
          <p>{error}</p>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => setRetry(current => current + 1)}
          >
            Recharger le mur
          </Button>
        </div>
      )}
      {cleanup.length > 0 && (
        <div role="status" className="yk-profile-notice">
          <p>Un fichier inutilisé attend son nettoyage.</p>
          <Button
            variant="secondary"
            onClick={() => {
              const paths = cleanup;
              setCleanup([]);
              paths.forEach(path => void discard(path));
            }}
          >
            Réessayer le nettoyage
          </Button>
        </div>
      )}
      {loading && !posts.length && (
        <p className="yk-profile-empty" role="status">
          Chargement du mur…
        </p>
      )}
      {!loading && !error && !posts.length && (
        <div className="yk-profile-surface yk-wall-empty">
          <h3>Le mur attend sa première histoire</h3>
          <p>
            {isMe
              ? "Partage ce qui te plaît avec tes visiteurs."
              : "Aucune publication pour le moment."}
          </p>
        </div>
      )}
      <div className="yk-wall-posts">
        {posts.map(post => (
          <article
            className="yk-profile-surface yk-wall-post"
            key={post.id}
            data-wall-post={post.id}
          >
            <header>
              <div className="yk-wall-author">
                <Avatar
                  name={pseudo}
                  image={avatarUrl ?? undefined}
                  size={38}
                />
                <div>
                  <strong>{pseudo}</strong>
                  <time dateTime={post.createdAt}>
                    {new Date(post.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </time>
                </div>
              </div>
              {isMe && (
                <Button
                  variant="secondary"
                  aria-label="Supprimer cette publication"
                  disabled={busy}
                  onClick={() => setRemoving(post)}
                >
                  Supprimer
                </Button>
              )}
            </header>
            {post.text && <p className="yk-wall-text">{post.text}</p>}
            {(post.mediaPath || post.gifUrl) && (
              <img
                className="yk-wall-media"
                src={
                  post.previewUrl ??
                  post.gifUrl ??
                  `/api/profile-wall/media/${post.id}`
                }
                alt={
                  post.gifUrl
                    ? "GIF publié sur le mur"
                    : "Image publiée sur le mur"
                }
                loading="lazy"
                decoding="async"
              />
            )}
          </article>
        ))}
      </div>
      {cursor && (
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => void more()}
        >
          {loading ? "Chargement…" : "Voir les publications précédentes"}
        </Button>
      )}
      <Modal
        open={!!removing}
        onClose={() => {
          if (!busy) setRemoving(null);
        }}
        title="Supprimer cette publication ?"
      >
        <p>Elle sera retirée de ton mur. Cette action est définitive.</p>
        {error && (
          <p role="alert" className="yk-profile-notice">
            {error}
          </p>
        )}
        <div className="yk-wall-compose-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            Supprimer la publication
          </Button>
        </div>
      </Modal>
      <Toast message={toast} onDismiss={() => setToast("")} />
    </section>
  );
}
