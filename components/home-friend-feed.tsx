"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { StyledPlayerName } from "@/components/styled-player-name";
import { ProfileWall } from "@/components/profile-wall";
import { type WallAdapter } from "@/lib/data/profile-wall";
import type { WallInteractions } from "@/lib/data/wall-interactions";
import {
  appendFeedPage,
  getFriendFeed,
  type FriendFeedPage,
  type FriendFeedPost,
  type FriendFeedLoader
} from "@/lib/data/friend-feed";
import "@/styles/friend-feed.css";

export function HomeFriendFeed({
  initial,
  initialError = "",
  viewer,
  wallAdapter,
  load = getFriendFeed
}: {
  initial: FriendFeedPage;
  initialError?: string;
  viewer?: FriendFeedPost["author"];
  wallAdapter?: WallAdapter;
  interactions?: WallInteractions;
  load?: FriendFeedLoader;
}) {
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [composerOpen, setComposerOpen] = useState(false);
  const pending = useRef(false);
  const request = useRef(0);
  const timeline = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => {
    request.current++;
    pending.current = false;
  }, []);

  useEffect(() => {
    const id = ++request.current;
    pending.current = false;
    void Promise.resolve().then(() => {
      if (request.current !== id) return;
      setPage(initial);
      setBusy(false);
      setError(initialError);
    });
    return cancel;
  }, [initial, initialError, cancel]);

  const reload = useCallback(
    async (clear = false) => {
      const id = ++request.current;
      pending.current = true;
      setBusy(true);
      setError("");
      // Block changes hide cached posts immediately; ordinary refreshes keep previews.
      if (clear) setPage({ items: [], next: null });
      try {
        const next = await load();
        if (id === request.current) setPage(next);
      } catch {
        if (id === request.current) {
          setPage({ items: [], next: null });
          setError("Couldn't refresh your feed. Please try again.");
        }
      } finally {
        if (id === request.current) {
          pending.current = false;
          setBusy(false);
        }
      }
    },
    [load]
  );

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const blockChanged = () => void reload(true);
    window.addEventListener("focus", refresh);
    window.addEventListener("player-block-changed", blockChanged);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("player-block-changed", blockChanged);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  useEffect(() => {
    const strip = timeline.current;
    if (!strip) return;
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))
        return;
      if (strip.scrollWidth <= strip.clientWidth || !event.deltaY) return;
      event.preventDefault();
      strip.scrollLeft +=
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? strip.clientWidth
            : 1);
    };
    strip.addEventListener("wheel", scroll, { passive: false });
    return () => strip.removeEventListener("wheel", scroll);
  }, []);

  async function more() {
    if (pending.current || !page.next) return;
    pending.current = true;
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const next = await load(page.next);
      if (id === request.current)
        setPage(current => ({
          items: appendFeedPage(current.items, next.items),
          next: next.next
        }));
    } catch {
      if (id === request.current) {
        setPage({ items: [], next: null });
        setError(
          "Your feed is unavailable or access has changed. Refresh to try again."
        );
      }
    } finally {
      if (id === request.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section className="yk-friend-feed" aria-labelledby="home-friend-feed">
      <header className="yk-feed-heading">
        <div>
          <h2 id="home-friend-feed">Friend feed</h2>
        </div>
        <Link
          href="/profile?tab=wall"
          className="yk-button yk-button-primary yk-home-panel-action"
        >
          View my wall <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <div className="yk-feed-toolbar">
        <div className="yk-feed-actions">
          {viewer && (
            <Button
              variant="secondary"
              className="yk-home-panel-action yk-feed-icon-action"
              aria-label="Add post"
              title="Add post"
              aria-expanded={composerOpen}
              aria-controls="home-feed-composer"
              onClick={() => setComposerOpen(open => !open)}
            >
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Button>
          )}
          <Button
            variant="secondary"
            className="yk-home-panel-action yk-feed-icon-action yk-feed-refresh"
            aria-label={busy ? "Refreshing feed" : "Refresh feed"}
            title="Refresh feed"
            disabled={busy}
            onClick={() => void reload()}
          >
            <svg
              aria-hidden="true"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={
                busy ? "animate-spin motion-reduce:animate-none" : undefined
              }
            >
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            </svg>
          </Button>
        </div>
      </div>
      {viewer && (
        <div
          id="home-feed-composer"
          className="yk-feed-composer"
          hidden={!composerOpen}
        >
          <ProfileWall
            ownerId={viewer.id}
            pseudo={viewer.name}
            avatarUrl={viewer.avatarUrl}
            isMe
            isPublic={false}
            canRead
            active
            composerOnly
            adapter={wallAdapter}
            onPublished={() => {
              timeline.current?.scrollTo({ left: 0, top: 0 });
              void reload();
            }}
          />
          <p className="yk-feed-publish-note">
            Posts appear here, on your wall and in your friends&apos; feeds.
            Your profile visibility still applies.
          </p>
        </div>
      )}
      <div
        className="yk-feed-timeline"
        ref={timeline}
        tabIndex={0}
        aria-label="Friends' wall posts"
        aria-busy={busy}
      >
        {error && (
          <p role="alert" className="yk-feed-empty">
            {error}
          </p>
        )}
        {busy && !page.items.length && (
          <p role="status" className="yk-feed-empty">
            Loading your timeline…
          </p>
        )}
        {!busy && !error && !page.items.length && (
          <div className="yk-feed-empty">
            <h3>Your timeline starts with your friends</h3>
            <p>Share a post above or add friends to start your timeline.</p>
            <Link href="/friends">
              Find friends <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
        {page.items.map(post => {
          const wall = `/profile/${encodeURIComponent(post.author.id)}?tab=wall`;
          return (
            <article
              className="yk-feed-post"
              key={post.id}
              data-feed-post={post.id}
              data-has-media={Boolean(post.hasMedia || post.gifUrl)}
            >
              <Link
                href={wall}
                aria-label={`View ${post.author.name}'s wall`}
                className="yk-feed-avatar"
              >
                <Avatar
                  name={post.author.name}
                  image={post.author.avatarUrl ?? undefined}
                  size={42}
                />
              </Link>
              <div className="yk-feed-post-content">
                <header>
                  <Link href={wall} className="yk-feed-author">
                    <StyledPlayerName
                      name={post.author.name}
                      cosmetics={post.author.profileStyle ?? undefined}
                    />
                  </Link>
                  <span aria-hidden="true">·</span>
                  <time dateTime={post.createdAt}>
                    {new Date(post.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </time>
                </header>
                {(post.hasMedia || post.gifUrl) && (
                  <Link
                    href={wall}
                    className="yk-feed-media-preview"
                    aria-label={`View ${post.author.name}'s wall post`}
                  >
                    <img
                      src={
                        post.hasMedia
                          ? `/api/profile-wall/media/${post.id}`
                          : post.gifUrl!
                      }
                      alt={
                        post.gifUrl
                          ? "GIF shared on a wall"
                          : "Image shared on a wall"
                      }
                      loading="lazy"
                      decoding="async"
                      className="yk-feed-media"
                    />
                  </Link>
                )}
                {post.text && <p className="yk-feed-text">{post.text}</p>}
                <Link href={wall} className="yk-feed-wall-link">
                  View wall <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>
          );
        })}
        {page.next && (
          <div className="yk-feed-more">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void more()}
            >
              {busy ? "Loading…" : "Load older posts"}
            </Button>
          </div>
        )}
        {!page.next && page.items.length > 0 && (
          <p className="yk-feed-end">You&apos;re all caught up.</p>
        )}
      </div>
    </section>
  );
}
