"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { Avatar, Button, Modal } from "@/components/ui";
import type { FriendUser } from "@/lib/data/friends";
import {
  livePrivateMessages,
  PrivateMessagesError,
  type PrivateMessage,
  type PrivateMessagePage,
  type PrivateMessagesAdapter
} from "@/lib/data/private-messages";
import { startVisiblePolling } from "@/lib/ui/visible-polling";

function mergeMessages(first: PrivateMessage[], second: PrivateMessage[]) {
  return [
    ...new Map(
      [...first, ...second].map(message => [message.id, message])
    ).values()
  ].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}
const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit"
});
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

export function PrivateMessages({
  friend,
  onClose,
  adapter = livePrivateMessages
}: {
  friend: FriendUser;
  onClose: () => void;
  adapter?: PrivateMessagesAdapter;
}) {
  const [page, setPage] = useState<PrivateMessagePage>();
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const sendingRef = useRef(false);
  const mounted = useRef(true);
  const scrollRestore = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let reading = false;
    const refresh = async () => {
      if (!active || reading) return;
      reading = true;
      try {
        const fresh = await adapter.list(friend.id);
        if (!active) return;
        setPage(current => {
          // A long hidden-tab gap starts a fresh bounded window. Older messages
          // remain reachable through the server cursor instead of leaving a gap.
          if (
            !current ||
            (fresh.next &&
              current.items.length &&
              !fresh.items.some(message =>
                current.items.some(old => old.id === message.id)
              ))
          )
            return fresh;
          return {
            ...current,
            viewerId: fresh.viewerId,
            items: mergeMessages(current.items, fresh.items)
          };
        });
        setError("");
        setUnavailable(false);
      } catch (reason) {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't load messages. Please try again."
        );
        if (reason instanceof PrivateMessagesError && reason.unavailable) {
          setPage(undefined);
          setUnavailable(true);
        }
      } finally {
        reading = false;
        if (active) setLoading(false);
      }
    };
    const stop = startVisiblePolling(() => void refresh(), 5_000);
    const onFocus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    const blocked = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; blocked: boolean }>)
        .detail;
      if (detail?.id === friend.id && detail.blocked) {
        active = false;
        setPage(undefined);
        setUnavailable(true);
        setError("This conversation is no longer available.");
      }
    };
    window.addEventListener("player-block-changed", blocked);
    return () => {
      active = false;
      stop();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("player-block-changed", blocked);
    };
  }, [adapter, friend.id, retry]);

  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    if (scrollRestore.current) {
      viewport.scrollTop =
        scrollRestore.current.top +
        viewport.scrollHeight -
        scrollRestore.current.height;
      scrollRestore.current = null;
    } else if (stickToBottom.current)
      viewport.scrollTop = viewport.scrollHeight;
  }, [page]);

  async function older() {
    if (!page?.next || loadingOlder || unavailable) return;
    setLoadingOlder(true);
    try {
      const olderPage = await adapter.list(friend.id, page.next);
      if (!mounted.current) return;
      const viewport = scroll.current;
      if (viewport)
        scrollRestore.current = {
          height: viewport.scrollHeight,
          top: viewport.scrollTop
        };
      setPage(
        current =>
          current && {
            ...current,
            items: mergeMessages(olderPage.items, current.items),
            next: olderPage.next
          }
      );
      setError("");
    } catch (reason) {
      if (!mounted.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't load older messages."
      );
      if (reason instanceof PrivateMessagesError && reason.unavailable) {
        setPage(undefined);
        setUnavailable(true);
      }
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (
      !text ||
      Array.from(text).length > 2000 ||
      !page ||
      unavailable ||
      sendingRef.current
    )
      return;
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    if (!pending.current || pending.current.text !== text)
      pending.current = { text, id: crypto.randomUUID() };
    try {
      const message = await adapter.send(friend.id, text, pending.current.id);
      if (!mounted.current) return;
      stickToBottom.current = true;
      setPage(
        current =>
          current && {
            ...current,
            items: mergeMessages(current.items, [message])
          }
      );
      setDraft("");
      pending.current = null;
    } catch (reason) {
      if (!mounted.current) return;
      setSendError(
        reason instanceof Error
          ? reason.message
          : "Couldn't send the message. Your draft has been kept."
      );
      if (reason instanceof PrivateMessagesError && reason.unavailable) {
        setPage(undefined);
        setUnavailable(true);
      }
    } finally {
      sendingRef.current = false;
      if (mounted.current) {
        setSending(false);
        requestAnimationFrame(() => {
          if (mounted.current) composer.current?.focus();
        });
      }
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Messages with ${friend.pseudo}`}
      className="yk-private-messages-modal"
    >
      <div className="yk-private-messages-contact">
        <Avatar
          name={friend.pseudo}
          image={friend.avatarUrl ?? undefined}
          online={friend.isOnline}
        />
        <div>
          <strong>{friend.pseudo}</strong>
          <p>Only you and your friend can access this conversation.</p>
        </div>
      </div>
      <div
        className="yk-private-messages-log"
        ref={scroll}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={loading}
        onScroll={() => {
          const viewport = scroll.current;
          if (viewport)
            stickToBottom.current =
              viewport.scrollHeight -
                viewport.scrollTop -
                viewport.clientHeight <
              60;
        }}
      >
        {page?.next && (
          <div className="yk-private-messages-older">
            <Button
              variant="secondary"
              disabled={loadingOlder}
              onClick={() => void older()}
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        )}
        {loading ? (
          <p className="yk-private-messages-empty" role="status">
            Loading messages…
          </p>
        ) : page && !page.items.length ? (
          <div className="yk-private-messages-empty">
            <strong>Start a conversation</strong>
            <p>Say hello to {friend.pseudo}.</p>
          </div>
        ) : null}
        {page?.items.map(message => {
          const own = message.senderId === page.viewerId;
          return (
            <div
              className={`yk-private-message${own ? " is-own" : ""}`}
              key={message.id}
            >
              <p>{message.text}</p>
              <time
                dateTime={message.createdAt}
                title={new Date(message.createdAt).toLocaleString("en-US")}
              >
                <span className="sr-only">{own ? "You" : friend.pseudo}, </span>
                {date.format(new Date(message.createdAt))} ·{" "}
                {time.format(new Date(message.createdAt))}
              </time>
            </div>
          );
        })}
      </div>
      {(sendError || error) && (
        <div className="yk-private-messages-error">
          <p role="alert">{sendError || error}</p>
          {!unavailable && !sendError && (
            <button type="button" onClick={() => setRetry(value => value + 1)}>
              Try again
            </button>
          )}
        </div>
      )}
      <form
        className="yk-private-messages-compose"
        onSubmit={event => void send(event)}
      >
        <label className="sr-only" htmlFor="private-message-draft">
          Message to {friend.pseudo}
        </label>
        <textarea
          ref={composer}
          id="private-message-draft"
          placeholder={`Message ${friend.pseudo}…`}
          value={draft}
          maxLength={2000}
          rows={3}
          disabled={sending || loading || unavailable || !page}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby="private-message-hint"
        />
        <div>
          <span id="private-message-hint">
            Enter to send · Shift + Enter for a new line{" "}
            <small>{draft.length.toLocaleString("en-US")} / 2,000</small>
          </span>
          <Button
            type="submit"
            disabled={
              sending || loading || unavailable || !page || !draft.trim()
            }
          >
            {sending ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
