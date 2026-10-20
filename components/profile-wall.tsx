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
  composerOnly = false,
  adapter = liveWall
}: {
  ownerId: string;
  pseudo: string;
  avatarUrl: string | null;
  isMe: boolean;
  isPublic: boolean;
  canRead: boolean;
  active: boolean;
  composerOnly?: boolean;
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
    if (!active || !canRead || composerOnly) return;
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
            setError("Couldn't load the wall. Please try again in a moment.");
          }
        }
      )
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [active, canRead, composerOnly, ownerId, adapter, retry]);
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
      setError("JPG, PNG, WebP, or GIF, up to 6 MB.");
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
      setToast("Post added to your wall");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't publish your post. Your draft has been kept."
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
      setToast("Post deleted");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't delete this post."
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
      setError(
        "The wall is unavailable or its access has changed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }
  if (!canRead)
    return (
      <section className="yk-profile-surface yk-wall-private">
        <h2>This wall is private</h2>
        <p>Only their friends can see these posts.</p>
      </section>
    );
  return (
    <section className="yk-profile-wall">
      {!composerOnly && (
        <div className="yk-profile-section-heading">
          <div>
            <p className="eyebrow">Their posts</p>
            <h2>Wall of {pseudo}</h2>
          </div>
          <span className="yk-wall-audience">
            {isPublic
              ? "Public · All players"
              : "Private · You and your friends"}
          </span>
        </div>
      )}
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
            Your post
          </label>
          <textarea
            id="wall-text"
            className="auth-input"
            value={text}
            maxLength={3000}
            disabled={busy}
            placeholder="A discovery, a new card, a thought… share what's on your mind."
            onChange={event => {
              setText(event.target.value);
              requestId.current = null;
            }}
          />
          {(preview || gif) && (
            <div className="yk-wall-attachment">
              <img src={preview || gif} alt="Attachment preview" />
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => changeAttachment(null)}
              >
                Remove attachment
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
                Add image
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Wall image"
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
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </div>
          <p className="yk-profile-muted">
            One image or GIF per post · Up to 6 MB. Visibility follows your
            profile settings.
          </p>
        </form>
      )}
      {error && (
        <div role="alert" className="yk-profile-notice">
          <p>{error}</p>
          {!composerOnly && (
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setRetry(current => current + 1)}
            >
              Reload wall
            </Button>
          )}
        </div>
      )}
      {cleanup.length > 0 && (
        <div role="status" className="yk-profile-notice">
          <p>An unused file is waiting to be removed.</p>
          <Button
            variant="secondary"
            onClick={() => {
              const paths = cleanup;
              setCleanup([]);
              paths.forEach(path => void discard(path));
            }}
          >
            Retry cleanup
          </Button>
        </div>
      )}
      {loading && !posts.length && (
        <p className="yk-profile-empty" role="status">
          Loading wall…
        </p>
      )}
      {!composerOnly && !loading && !error && !posts.length && (
        <div className="yk-profile-surface yk-wall-empty">
          <h3>Your wall is waiting for its first story</h3>
          <p>
            {isMe ? "Share what you love with your visitors." : "No posts yet."}
          </p>
        </div>
      )}
      {!composerOnly && (
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
                    <strong>
                      <StyledPlayerName
                        name={pseudo}
                        cosmetics={post.profileStyle}
                      />
                    </strong>
                    <time dateTime={post.createdAt}>
                      {new Date(post.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </time>
                  </div>
                </div>
                {isMe && (
                  <Button
                    variant="secondary"
                    aria-label="Delete this post"
                    disabled={busy}
                    onClick={() => setRemoving(post)}
                  >
                    Remove
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
                      ? "GIF posted on the wall"
                      : "Image posted on the wall"
                  }
                  loading="lazy"
                  decoding="async"
                />
              )}
            </article>
          ))}
        </div>
      )}
      {!composerOnly && cursor && (
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => void more()}
        >
          {loading ? "Loading…" : "See older posts"}
        </Button>
      )}
      <Modal
        open={!!removing}
        onClose={() => {
          if (!busy) setRemoving(null);
        }}
        title="Delete this post?"
      >
        <p>It will be removed from your wall. This can&apos;t be undone.</p>
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
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            Delete post
          </Button>
        </div>
      </Modal>
      <Toast message={toast} onDismiss={() => setToast("")} />
    </section>
  );
}
import { StyledPlayerName } from "@/components/styled-player-name";
