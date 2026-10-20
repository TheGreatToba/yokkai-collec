"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
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
  const lock = useRef(false);
  const sequence = useRef(0);
  const replyId = useRef<string | null>(null);
  const fieldId = useId();
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
    kind: "like" | "reply" | "more" | "remove",
    id?: string
  ) {
    if (lock.current || !activity) return;
    if (kind === "reply" && !text.trim()) return;
    lock.current = true;
    const version = ++sequence.current;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let next: WallActivity;
      if (kind === "like")
        next = await adapter.like(postId, !activity.likedByMe);
      else if (kind === "reply") {
        replyId.current ??= crypto.randomUUID();
        next = await adapter.reply(postId, replyId.current, text.trim());
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
        replyId.current = null;
        setStatus("Reply published");
      }
      if (kind === "remove") setStatus("Reply deleted");
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
          aria-pressed={activity?.likedByMe ?? false}
          disabled={busy || !activity}
          onClick={() => void update("like")}
        >
          <span aria-hidden="true">{activity?.likedByMe ? "♥" : "♡"}</span>{" "}
          {activity?.likedByMe ? "Liked" : "Like"}
          {activity ? ` · ${activity.likes.toLocaleString("en-US")}` : ""}
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${fieldId}-thread`}
          disabled={!activity}
          onClick={() => setOpen(value => !value)}
        >
          <span aria-hidden="true">↩</span> Reply
          {activity ? ` · ${activity.replyCount.toLocaleString("en-US")}` : ""}
        </button>
      </div>
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
      {open && (
        <div id={`${fieldId}-thread`} className="yk-post-thread">
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
            <div>
              <span>{text.length}/1000</span>
              <Button
                type="submit"
                disabled={busy || !activity || !text.trim()}
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
                size={28}
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
                <p>{reply.text}</p>
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
