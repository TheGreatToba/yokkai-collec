"use client";

import { useMemo, useState } from "react";
import { FriendsPanel, type FriendsPanelAdapter } from "@/components/friends";
import { Button } from "@/components/ui";
import type { TradesPanelAdapter } from "@/components/trades";
import {
  PrivateMessagesError,
  isPrivateMessageGif,
  type PrivateMessage,
  type PrivateMessagesAdapter
} from "@/lib/data/private-messages";

const players = [
  { id: "preview-bbdou", pseudo: "BBDOU", isOnline: true },
  { id: "preview-kitsune", pseudo: "Kitsune", isOnline: true },
  {
    id: "preview-yuki",
    pseudo: "Yuki",
    isOnline: false,
    lastSeenAt: new Date("2026-10-19T00:00:00Z").toISOString()
  }
];
const storageKey = "yokkai:private-messages-preview:v1";
const order = (a: PrivateMessage, b: PrivateMessage) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
function readMessages(): PrivateMessage[] {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : [];
  } catch {
    throw new Error(
      "Local storage is unavailable. Enable it to test messages."
    );
  }
}

export function PrivateMessagesPreview() {
  const [playerId, setPlayerId] = useState(players[0].id);
  const [failure, setFailure] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const messages = useMemo<PrivateMessagesAdapter>(
    () => ({
      list: async (friendId, cursor) => {
        const all = readMessages()
          .filter(
            message =>
              (message.senderId === playerId &&
                message.recipientId === friendId) ||
              (message.senderId === friendId &&
                message.recipientId === playerId)
          )
          .filter(
            message =>
              !cursor ||
              message.createdAt < cursor.at ||
              (message.createdAt === cursor.at && message.id < cursor.id)
          )
          .sort(order);
        const items = all.slice(-40);
        return {
          viewerId: playerId,
          items,
          next:
            all.length > 40 ? { at: items[0].createdAt, id: items[0].id } : null
        };
      },
      send: async (friendId, text, id, gifUrl) => {
        await new Promise(resolve => window.setTimeout(resolve, 180));
        if (failure) {
          setFailure(false);
          throw new Error(
            "Couldn't send the message. Your draft has been kept."
          );
        }
        if (
          (!text.trim() && !gifUrl) ||
          Array.from(text.trim()).length > 2000 ||
          (gifUrl && !isPrivateMessageGif(gifUrl))
        )
          throw new PrivateMessagesError(
            "Write a message between 1 and 2,000 characters."
          );
        const all = readMessages();
        const existing = all.find(message => message.id === id);
        if (existing) return existing;
        const message = {
          id,
          senderId: playerId,
          recipientId: friendId,
          text: text.trim(),
          gifUrl: gifUrl ?? null,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify([...all, message]));
        return message;
      }
    }),
    [playerId, failure]
  );
  const trades = useMemo<TradesPanelAdapter>(
    () => ({
      friendships: async () => ({
        friends: players.filter(player => player.id !== playerId),
        incoming: [],
        outgoing: []
      }),
      listOffers: async () => [],
      context: async friendId => ({
        friend: players.find(player => player.id === friendId)!,
        balance: 4499,
        ownCards: [],
        friendCards: []
      }),
      create: async () => {
        throw new Error("Local preview only. No real trade offer was sent.");
      },
      cancel: async () => true,
      respond: async () => true
    }),
    [playerId]
  );
  const adapter = useMemo<FriendsPanelAdapter>(
    () => ({
      friendships: async () => ({
        friends: players.filter(player => player.id !== playerId),
        incoming: [],
        outgoing: []
      }),
      search: async query =>
        players
          .filter(
            player =>
              player.id !== playerId &&
              player.pseudo.toLowerCase().includes(query.toLowerCase())
          )
          .map(player => ({ ...player, status: "accepted" as const })),
      respond: async () => undefined,
      remove: async () => undefined,
      moderation: {
        list: async () => [],
        block: async () => undefined,
        unblock: async () => undefined,
        report: async () => undefined
      },
      messages,
      trades
    }),
    [playerId, messages, trades]
  );

  function seed() {
    const friendId = players.find(player => player.id !== playerId)!.id;
    const now = Date.now();
    const seeded = Array.from({ length: 55 }, (_, index) => ({
      id: crypto.randomUUID(),
      senderId: index % 2 ? playerId : friendId,
      recipientId: index % 2 ? friendId : playerId,
      text:
        index % 2
          ? `Sounds good! Message ${index + 1}.`
          : `Want to trade a card later? Message ${index + 1}.`,
      createdAt: new Date(now - (55 - index) * 60_000).toISOString()
    }));
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify([...readMessages(), ...seeded])
      );
      setVersion(value => value + 1);
      setError("");
    } catch {
      setError("Couldn't save the local test messages.");
    }
  }
  return (
    <>
      <div className="yk-private-messages-preview-tools">
        <label>
          View as{" "}
          <select
            className="auth-input"
            aria-label="Preview player"
            value={playerId}
            onChange={event => setPlayerId(event.target.value)}
          >
            {players.map(player => (
              <option key={player.id} value={player.id}>
                {player.pseudo}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={seed}>
          Add sample conversation
        </Button>
        <label>
          <input
            type="checkbox"
            checked={failure}
            onChange={event => setFailure(event.target.checked)}
          />{" "}
          Fail the next send
        </label>
        <p>
          Local preview only. Choose a player, click Message, then switch
          players to reply. Two tabs share this test history. No real players
          are contacted.
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      <FriendsPanel key={`${playerId}:${version}`} adapter={adapter} />
    </>
  );
}
