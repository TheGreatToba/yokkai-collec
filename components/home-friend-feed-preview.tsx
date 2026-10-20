"use client";

import { useMemo, useState } from "react";
import { HomeFriendFeed } from "@/components/home-friend-feed";
import { Button } from "@/components/ui";
import type { FriendFeedLoader, FriendFeedPost } from "@/lib/data/friend-feed";
import { AUTH_MARQUEE_CARDS } from "@/lib/auth/showcase-cards";
import type { WallAdapter } from "@/lib/data/profile-wall";

const posts: FriendFeedPost[] = [
  {
    id: "sample-1",
    text: "Finally completed my Jujutsu Kaisen binder! That last card was worth the wait. ✨",
    hasMedia: false,
    gifUrl: null,
    createdAt: "2026-10-20T18:45:00Z",
    author: {
      id: "preview-kitsune",
      name: "Kitsune",
      avatarUrl: AUTH_MARQUEE_CARDS[0].image
    }
  },
  {
    id: "sample-2",
    text: "Today's Decision Pack really made me choose… Gojo or NEWJEANS?",
    hasMedia: false,
    gifUrl:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjEx/3o7aD2saalBwwftBIY/giphy.gif",
    createdAt: "2026-10-20T18:30:00Z",
    author: {
      id: "preview-moonflower",
      name: "Moonflower",
      avatarUrl: AUTH_MARQUEE_CARDS[1].image
    }
  },
  {
    id: "sample-3",
    text: "Looking for a spare Bart Simpson for my collection. See you in trades!",
    hasMedia: false,
    gifUrl: null,
    createdAt: "2026-10-20T18:15:00Z",
    author: { id: "preview-raven", name: "Raven", avatarUrl: null }
  },
  {
    id: "sample-4",
    text: "A new favorite for the collection. What did you pull today?",
    hasMedia: false,
    gifUrl: null,
    createdAt: "2026-10-20T18:00:00Z",
    author: {
      id: "preview-kitsune",
      name: "Kitsune",
      avatarUrl: AUTH_MARQUEE_CARDS[0].image
    }
  }
];

export function HomeFriendFeedPreview() {
  const [empty, setEmpty] = useState(false);
  const [fail, setFail] = useState(false);
  const [failPublish, setFailPublish] = useState(false);
  const [published, setPublished] = useState("");
  const [publishCount, setPublishCount] = useState(0);
  const wallAdapter = useMemo<WallAdapter>(
    () => ({
      list: async () => {
        throw new Error("Composer must not fetch the wall");
      },
      publish: async input => {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (failPublish)
          throw new Error(
            "Couldn't publish your post. Your draft has been kept."
          );
        setPublished(input.text || "Media post");
        setPublishCount(count => count + 1);
        return { ...input, createdAt: new Date().toISOString() };
      },
      upload: async (_file, ownerId) => `${ownerId}/preview.png`,
      remove: async () => null,
      discard: async () => {}
    }),
    [failPublish]
  );
  const initial = useMemo(
    () => ({
      items: empty ? [] : posts.slice(0, 3),
      next: empty ? null : { at: posts[2].createdAt, id: posts[2].id }
    }),
    [empty]
  );
  const load = useMemo<FriendFeedLoader>(
    () => async cursor => {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (fail) throw new Error("Preview failure");
      return {
        items: empty ? [] : cursor ? posts.slice(2) : posts.slice(0, 3),
        next: !empty && !cursor ? initial.next : null
      };
    },
    [fail, empty, initial.next]
  );
  return (
    <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
      <div
        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
      >
        <Button variant="secondary" onClick={() => setEmpty(value => !value)}>
          {empty ? "Show sample posts" : "Preview empty feed"}
        </Button>
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={event => setFail(event.target.checked)}
          />{" "}
          Fail feed requests
        </label>
        <label>
          <input
            type="checkbox"
            checked={failPublish}
            onChange={event => setFailPublish(event.target.checked)}
          />{" "}
          Fail wall publishing
        </label>
        <p>Local preview only. Sample posts; no real players are contacted.</p>
        {published && (
          <p role="status" data-preview-published={publishCount}>
            Preview post published: {published}
          </p>
        )}
      </div>
      <HomeFriendFeed
        initial={initial}
        load={load}
        viewer={posts[2].author}
        wallAdapter={wallAdapter}
      />
    </div>
  );
}
