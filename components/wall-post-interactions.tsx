"use client";
/* eslint-disable @next/next/no-img-element -- authenticated private media and animated GIFs. */

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { EmojiReactionPicker } from "@/components/emoji-reaction-picker";
import { GifPicker } from "@/components/gif-picker";
import { reactionEmoji } from "@/lib/ui/reaction-emojis";
import {
  liveWallInteractions,
  type WallActivity,
  type WallInteractions
} from "@/lib/data/wall-interactions";
import "@/styles/wall-interactions.css";

export function WallPostInteractions({
  postId,
  adapter = liveWallInteractions
}: {
  postId: string;
  adapter?: WallInteractions;
}) {
  const [activity, setActivity] = useState<WallActivity | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [gif, setGif] = useState("");
  const [cleanup, setCleanup] = useState<string[]>([]);
  const uploaded = useRef<{ file: File; path: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const sequence = useRef(0);
  const replyId = useRef<string | null>(null);
  const fieldId = useId();
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );
  async function discard(path: string) {
    try {
      if (!adapter.discard) throw new Error("File cleanup is unavailable.");
      await adapter.discard(path);
      setCleanup(current => current.filter(item => item !== path));
    } catch {
      setCleanup(current => [...new Set([...current, path])]);
    }
  }
  function changeAttachment(next: File | null, nextGif = "") {
    if (lock.current) return;
    if (
      next &&
      (!next.size ||
        next.size > 6 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          next.type
        ))
    ) {
      setError("JPG, PNG, WebP, or GIF, up to 6 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (uploaded.current) {
      void discard(uploaded.current.path);
      uploaded.current = null;
    }
    replyId.current = null;
    setError("");
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
    setGif(nextGif);
    if (fileInput.current) fileInput.current.value = "";
  }
  const cancel = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    const version = ++sequence.current;
    void adapter.read(postId).then(
      value => {
        if (version === sequence.current) {
          setActivity(value);
          setError("");
        }
      },
      () => {
        if (version === sequence.current) {
          setActivity(null);
          setError("Couldn't load this post's activity. Please try again.");
        }
      }
    );
    return cancel;
  }, [adapter, postId, retry, cancel]);

  async function update(
    kind: "like" | "reply" | "more" | "remove" | "react",
    id?: string
  ) {
    if (lock.current || !activity) return;
    if (kind === "reply" && !text.trim() && !file && !gif) return;
    lock.current = true;
    const version = ++sequence.current;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let next: WallActivity;
      if (kind === "like")
        next = await adapter.like(postId, !activity.likedByMe);
      else if (kind === "react") {
        const current = activity.reactions?.find(item => item.emoji === id);
        next = await adapter.react(postId, id!, !current?.reactedByMe);
      } else if (kind === "reply") {
        replyId.current ??= crypto.randomUUID();
        if (file && uploaded.current?.file !== file) {
          if (!adapter.upload)
            throw new Error("Image uploads are unavailable. Please try again.");
          uploaded.current = { file, path: await adapter.upload(file) };
        }
        next = await adapter.reply(postId, replyId.current, text.trim(), {
          mediaPath: uploaded.current?.path ?? null,
          gifUrl: gif || null
        });
      } else if (kind === "remove") next = await adapter.remove(postId, id!);
      else next = await adapter.read(postId, activity.next);
      if (version !== sequence.current) return;
      setActivity(
        kind === "more"
          ? {
              ...next,
              items: [
                ...new Map(
                  [...activity.items, ...next.items].map(item => [
                    item.id,
                    item
                  ])
                ).values()
              ]
            }
          : next
      );
      if (kind === "reply") {
        setText("");
        uploaded.current = null;
        setFile(null);
        setPreview("");
        setGif("");
        replyId.current = null;
        setStatus("Reply published");
      }
      if (kind === "remove") {
        setStatus("Reply deleted");
        const path =
          next.deletedMediaPath ??
          activity.items.find(item => item.id === id && item.isMe)?.mediaPath;
        if (path) void discard(path);
      }
    } catch (reason) {
      if (version === sequence.current) {
        setActivity(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't update this post. Your draft has been kept."
        );
      }
    } finally {
      lock.current = false;
      if (version === sequence.current) setBusy(false);
    }
  }
  return (
    <div className="yk-wall-interactions" data-post-activity={postId}>
      <div className="yk-post-actions">
        <button
          type="button"
          className="yk-post-like"
          aria-pressed={activity?.likedByMe ?? false}
          disabled={busy || !activity}
          onClick={() => void update("like")}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill={activity?.likedByMe ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          <span>{activity?.likedByMe ? "Liked" : "Like"}</span>
          {activity && (
            <strong className="yk-action-count">
              {activity.likes.toLocaleString("en-US")}
            </strong>
          )}
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${fieldId}-thread`}
          disabled={!activity}
          onClick={() => setOpen(value => !value)}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 3V11.5a8.5 8.5 0 0 1 8.5-8.5h3a8.5 8.5 0 0 1 8.5 8.5Z" />
          </svg>
          <span>Reply</span>
          {activity && (
            <strong className="yk-action-count">
              {activity.replyCount.toLocaleString("en-US")}
            </strong>
          )}
        </button>
        <EmojiReactionPicker
          disabled={busy || !activity}
          selected={
            activity?.reactions
              ?.filter(item => item.reactedByMe)
              .map(item => item.emoji) ?? []
          }
          onSelect={emoji => void update("react", emoji)}
        />
      </div>
      {!!activity?.reactions?.length && (
        <div className="yk-reaction-chips" aria-label="Post reactions">
          {activity.reactions.map(item => {
            const choice = reactionEmoji(item.emoji);
            if (!choice) return null;
            return (
              <button
                key={item.emoji}
                type="button"
                aria-label={`${choice.label}: ${item.count.toLocaleString("en-US")} ${item.count === 1 ? "reaction" : "reactions"}`}
                aria-pressed={item.reactedByMe}
                disabled={busy}
                title={
                  item.reactedByMe
                    ? `Remove ${choice.label} reaction`
                    : `React with ${choice.label}`
                }
                onClick={() => void update("react", item.emoji)}
              >
                <span aria-hidden="true">{choice.emoji}</span>
                <strong>{item.count.toLocaleString("en-US")}</strong>
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <div role="alert" className="yk-post-error">
          <p>{error}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setBusy(false);
              setRetry(value => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {status && (
        <p role="status" className="yk-post-status">
          {status}
        </p>
      )}
      {!!cleanup.length && (
        <div className="yk-post-error" role="alert">
          <p>
            A removed attachment couldn&apos;t be cleaned up. Your reply is
            safe.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              for (const path of cleanup) void discard(path);
            }}
          >
            Retry file cleanup
          </Button>
        </div>
      )}
      {open && (
        <div id={`${fieldId}-thread`} className="yk-post-thread">
          <div className="yk-thread-heading">
            <strong>Conversation</strong>
            <span>
              {activity?.replyCount ?? 0}{" "}
              {(activity?.replyCount ?? 0) === 1 ? "reply" : "replies"}
            </span>
          </div>
          <form
            onSubmit={event => {
              event.preventDefault();
              void update("reply");
            }}
          >
            <label htmlFor={fieldId}>Your reply</label>
            <textarea
              id={fieldId}
              className="auth-input"
              placeholder="Write a reply…"
              maxLength={1000}
              value={text}
              disabled={busy}
              onChange={event => {
                setText(event.target.value);
                replyId.current = null;
              }}
            />
            {(preview || gif) && (
              <figure className="yk-reply-attachment">
                <img src={preview || gif} alt="Reply attachment preview" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeAttachment(null)}
                >
                  Remove attachment
                </button>
              </figure>
            )}
            <div className="yk-reply-media-actions">
              <Button
                type="button"
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
                aria-label="Reply image"
                hidden
                disabled={busy}
                onChange={event => {
                  const next = event.target.files?.[0];
                  if (next) changeAttachment(next);
                }}
              />
              <GifPicker
                disabled={busy}
                onSelect={choice => changeAttachment(null, choice.url)}
              />
            </div>
            <p className="yk-post-status">
              One image or GIF per reply · Up to 6 MB. Visibility follows the
              post and your profile settings.
            </p>
            <div className="yk-reply-submit">
              <span>{text.length}/1000</span>
              <Button
                type="submit"
                disabled={busy || !activity || (!text.trim() && !file && !gif)}
              >
                {busy ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </form>
          {activity?.items.map(reply => (
            <article
              key={reply.id}
              data-wall-reply={reply.id}
              className="yk-post-reply"
            >
              <Avatar
                name={reply.author.name}
                image={reply.author.avatarUrl ?? undefined}
                size={32}
              />
              <div>
                <header>
                  <Link
                    href={`/profile/${encodeURIComponent(reply.author.id)}?tab=wall`}
                  >
                    {reply.author.name}
                  </Link>
                  <time dateTime={reply.createdAt}>
                    {new Date(reply.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </time>
                </header>
                {reply.text && <p>{reply.text}</p>}
                {(reply.hasMedia || reply.gifUrl) && (
                  <img
                    className="yk-reply-media"
                    loading="lazy"
                    src={
                      reply.hasMedia
                        ? (reply.previewUrl ??
                          `/api/profile-wall/reply-media/${encodeURIComponent(reply.id)}`)
                        : reply.gifUrl!
                    }
                    alt={
                      reply.hasMedia
                        ? "Image attached to reply"
                        : "GIF attached to reply"
                    }
                  />
                )}
                {reply.isMe && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void update("remove", reply.id)}
                  >
                    Delete reply
                  </button>
                )}
              </div>
            </article>
          ))}
          {activity && !activity.items.length && (
            <p className="yk-post-status">
              No replies yet. Start the conversation.
            </p>
          )}
          {activity?.next && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void update("more")}
            >
              Older replies
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
