import { createClient } from "@/utils/supabase/client";
import type { FriendFeedCursor, FriendFeedPost } from "./friend-feed";

export type WallReply = {
  id: string;
  text: string;
  createdAt: string;
  isMe: boolean;
  author: FriendFeedPost["author"];
};
export type WallActivity = {
  likes: number;
  likedByMe: boolean;
  replyCount: number;
  items: WallReply[];
  next: FriendFeedCursor | null;
};
export type WallInteractions = {
  read: (post: string, cursor?: FriendFeedCursor | null) => Promise<WallActivity>;
  like: (post: string, liked: boolean) => Promise<WallActivity>;
  reply: (post: string, id: string, text: string) => Promise<WallActivity>;
  remove: (post: string, id: string) => Promise<WallActivity>;
};
async function rpc(name: string, args: Record<string, unknown>): Promise<WallActivity> {
  const { data, error } = await createClient().rpc(name, args).abortSignal(AbortSignal.timeout(12000));
  if (error) {
    if (error.message === "WALL_REPLY_RATE_LIMITED") throw new Error("Please wait a few seconds between replies (up to 30 per hour).");
    if (error.message === "WALL_REPLIES_FULL") throw new Error("This post has reached its reply limit.");
    throw new Error("Couldn't load or update this post. Access may have changed. Please try again.");
  }
  return data as WallActivity;
}
export const liveWallInteractions: WallInteractions = {
  read: (post, cursor) => rpc("get_wall_post_activity", { p_post_id: post, p_before: cursor?.at ?? null, p_before_id: cursor?.id ?? null }),
  like: (post, liked) => rpc("set_wall_post_like", { p_post_id: post, p_liked: liked }),
  reply: (post, id, text) => rpc("publish_wall_post_reply", { p_post_id: post, p_id: id, p_body: text }),
  remove: (post, id) => rpc("delete_wall_post_reply", { p_post_id: post, p_reply_id: id })
};
