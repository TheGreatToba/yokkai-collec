"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, Modal } from "@/components/ui";
import { StyledPlayerName } from "@/components/styled-player-name";
import { ProfileWall } from "@/components/profile-wall";
import { liveWall, type WallAdapter } from "@/lib/data/profile-wall";
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
  const [removing, setRemoving] = useState<FriendFeedPost | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [cleanup, setCleanup] = useState<string[]>([]);
  const deleting = useRef(false);
  const storage = wallAdapter ?? liveWall;
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
  async function discard(path: string) {
    try {
      await storage.discard(path);
      setCleanup(current => current.filter(item => item !== path));
    } catch {
      setCleanup(current => [...new Set([...current, path])]);
    }
  }
  async function removePost() {
    if (deleting.current || !removing || removing.author.id !== viewer?.id)
      return;
    deleting.current = true;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const path = await storage.remove(removing.id);
      request.current++;
      pending.current = false;
      setBusy(false);
      setPage(current => ({
        ...current,
        items: current.items.filter(post => post.id !== removing.id)
      }));
      setRemoving(null);
      if (path) void discard(path);
    } catch (reason) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : "Couldn't delete this post. Please try again."
      );
    } finally {
      deleting.current = false;
      setDeleteBusy(false);
    }
  }

  return (
    <section className="yk-friend-feed" aria-labelledby="home-friend-feed">
      <header className="yk-feed-heading">
        <div>
          <p className="eyebrow">Between friends</p>
          <h2 id="home-friend-feed">Friend feed</h2>
          <p>Your posts and your friends&apos; walls. Newest first.</p>
        </div>
        <Link href="/profile?tab=wall" className="yk-button yk-button-primary">
          View my wall <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {viewer && (
        <details className="yk-feed-composer">
          <summary className="yk-button yk-button-secondary">Add post</summary>
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
              timeline.current?.scrollTo({ top: 0 });
              void reload();
            }}
          />
          <p className="yk-feed-publish-note">
            Posts appear here, on your wall and in your friends&apos; feeds.
            Your profile visibility still applies.
          </p>
        </details>
      )}
      <div className="yk-feed-toolbar">
        <span className="yk-feed-following">
          You &amp; friends <span aria-hidden="true">✦</span>
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
                  {post.author.id === viewer?.id && (
                    <button
                      type="button"
                      className="yk-feed-delete"
                      disabled={deleteBusy}
                      onClick={() => {
                        setDeleteError("");
                        setRemoving(post);
                      }}
                    >
                      Delete post
                    </button>
                  )}
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
                        ? "GIF shared on a wall"
                        : "Image shared on a wall"
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
      <footer className="yk-feed-footer">
        <span className="yk-feed-footer-signature">
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87" />
            <circle cx="9" cy="7" r="4" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Your circle. Your stories.
        </span>
        <span className="yk-feed-footer-note">Share. React. Connect.</span>
      </footer>
      {!!cleanup.length && (
        <div className="yk-feed-empty" role="alert">
          <p>
            Your post was deleted, but its image couldn&apos;t be cleaned up.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              for (const path of cleanup) void discard(path);
            }}
          >
            Retry file cleanup
          </Button>
        </div>
      )}
      {removing && (
        <Modal
          className="yk-feed-delete-modal"
          open
          onClose={() => {
            if (!deleting.current) setRemoving(null);
          }}
          title="Delete this post?"
        >
          <p>
            This removes it from your wall and your friends&apos; feeds, along
            with its replies and reactions. This cannot be undone.
          </p>
          {deleteError && <p role="alert">{deleteError}</p>}
          <div>
            <Button
              variant="secondary"
              disabled={deleteBusy}
              onClick={() => setRemoving(null)}
            >
              Cancel
            </Button>
            <Button
              className="yk-feed-delete"
              disabled={deleteBusy}
              onClick={() => void removePost()}
            >
              {deleteBusy ? "Deleting…" : "Delete post"}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
