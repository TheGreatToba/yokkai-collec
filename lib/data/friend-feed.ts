import { createClient } from "@/utils/supabase/client";
import { readRequest } from "@/lib/data/read-request";
import type { PlayerCosmetics } from "@/components/styled-player-name";

export type FriendFeedCursor = { at: string; id: string };
export type FriendFeedPost = {
  id: string;
  text: string;
  hasMedia: boolean;
  gifUrl: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    profileStyle?: PlayerCosmetics | null;
  };
};
export type FriendFeedPage = {
  items: FriendFeedPost[];
  next: FriendFeedCursor | null;
};
export type FriendFeedLoader = (cursor?: FriendFeedCursor | null) => Promise<FriendFeedPage>;

export const getFriendFeed: FriendFeedLoader = async cursor => {
  const { data, error } = await readRequest(signal =>
    createClient().rpc("get_home_wall_feed", {
      p_before: cursor?.at ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: 10
    }).abortSignal(signal)
  );
  if (error) throw new Error("Couldn't load your timeline. Please try again.");
  return data as FriendFeedPage;
};

export function appendFeedPage(current: FriendFeedPost[], next: FriendFeedPost[]) {
  return [...new Map([...current, ...next].map(post => [post.id, post])).values()];
}
