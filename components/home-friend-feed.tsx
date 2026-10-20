"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button } from "@/components/ui";
import { StyledPlayerName } from "@/components/styled-player-name";
import { ProfileWall } from "@/components/profile-wall";
import type { WallAdapter } from "@/lib/data/profile-wall";
import { WallPostInteractions } from "@/components/wall-post-interactions";
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
  interactions,
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
  const pending = useRef(false);
  const request = useRef(0);
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

  const reload = useCallback(async () => {
    const id = ++request.current;
    pending.current = true;
    setBusy(true);
    setError("");
    // Revalidate on return/block changes instead of retaining cached private posts.
    setPage({ items: [], next: null });
    try {
      const next = await load();
      if (id === request.current) setPage(next);
    } catch {
      if (id === request.current)
        setError("Couldn't refresh your feed. Please try again.");
    } finally {
      if (id === request.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("player-block-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("player-block-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

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
          <p className="eyebrow">Between friends</p>
          <h2 id="home-friend-feed">Friend feed</h2>
          <p>Fresh from your friends&apos; walls. Newest first.</p>
        </div>
        <Link href="/profile?tab=wall" className="yk-button yk-button-primary">
          View my wall <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {viewer && (
        <div className="yk-feed-composer">
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
          />
          <p className="yk-feed-publish-note">
            Posts appear on your wall and in your friends&apos; feeds. Your
            profile visibility still applies.
          </p>
        </div>
      )}
      <div className="yk-feed-toolbar">
        <span className="yk-feed-following">
          Friends only <span aria-hidden="true">✦</span>
        </span>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void reload()}
        >
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>
      <div
        className="yk-feed-timeline"
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
            Loading your friends&apos; posts…
          </p>
        )}
        {!busy && !error && !page.items.length && (
          <div className="yk-feed-empty">
            <h3>Your timeline starts with your friends</h3>
            <p>Posts shared on their walls will appear here.</p>
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
                {post.text && <p className="yk-feed-text">{post.text}</p>}
                {(post.hasMedia || post.gifUrl) && (
                  <img
                    src={
                      post.hasMedia
                        ? `/api/profile-wall/media/${post.id}`
                        : post.gifUrl!
                    }
                    alt={
                      post.gifUrl
                        ? "GIF shared on a friend's wall"
                        : "Image shared on a friend's wall"
                    }
                    loading="lazy"
                    decoding="async"
                    className="yk-feed-media"
                  />
                )}
                <WallPostInteractions postId={post.id} adapter={interactions} />
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
