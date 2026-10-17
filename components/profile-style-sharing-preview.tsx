"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AuctionChatPanel,
  type AuctionChatAdapter
} from "@/components/community-views";
import { ProfileWall } from "@/components/profile-wall";
import type { WallAdapter } from "@/lib/data/profile-wall";
import "@/styles/profile-style.css";

const createdAt = "2026-10-17T12:00:00.000Z";
async function readOnly(): Promise<never> {
  throw new Error("This preview is read-only.");
}
const wall: WallAdapter = {
  list: async () => ({
    items: [
      {
        id: "local-style-post",
        text: "Your next great pull starts here.",
        mediaPath: null,
        gifUrl: null,
        createdAt
      }
    ],
    next: null
  }),
  publish: readOnly,
  remove: readOnly,
  upload: readOnly,
  discard: readOnly
};

export function ProfileStyleSharingPreview({
  userId,
  name
}: {
  userId: string;
  name: string;
}) {
  const chat = useMemo<AuctionChatAdapter>(
    () => ({
      get: async () => ({
        canPost: false,
        participants: [],
        messages: [
          {
            id: "local-style-message",
            userId,
            pseudo: name,
            message: "Good luck with the auction!",
            createdAt,
            mine: true
          },
          {
            id: "local-other-message",
            userId: "another-local-collector",
            pseudo: name,
            message:
              "Same nickname, different collector. Their style stays unchanged.",
            createdAt,
            mine: false
          }
        ]
      }),
      send: readOnly,
      moderation: {
        list: async () => [],
        block: readOnly,
        unblock: readOnly,
        report: readOnly
      }
    }),
    [userId, name]
  );
  return (
    <main className="yk-style-sharing-preview">
      <Link href="/profile">← Back to your profile</Link>
      <h1>Your style, across Yokkai.</h1>
      <p>
        Apply a style on your profile, then return here to see it on messages
        and posts.
      </p>
      <p>
        Read-only local preview. No messages or posts are published. Reloading
        clears your style.
      </p>
      <div className="yk-style-sharing-grid">
        <section aria-label="Auction chat preview">
          <h2>Auction chat</h2>
          <AuctionChatPanel
            auctionId="local-style-preview"
            refreshKey={0}
            finished={true}
            adapter={chat}
          />
        </section>
        <section aria-label="Wall post preview">
          <h2>Wall posts</h2>
          <ProfileWall
            ownerId={userId}
            pseudo={name}
            avatarUrl={null}
            isMe={false}
            isPublic={true}
            canRead={true}
            active={true}
            adapter={wall}
          />
        </section>
      </div>
    </main>
  );
}
