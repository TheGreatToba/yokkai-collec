import { createClient } from "@/utils/supabase/client";
import { readRequest } from "@/lib/data/read-request";

export type PrivateMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
};
export type MessageCursor = { at: string; id: string };
export type PrivateMessagePage = {
  viewerId: string;
  items: PrivateMessage[];
  next: MessageCursor | null;
};
export type PrivateMessagesAdapter = {
  list: (friendId: string, cursor?: MessageCursor) => Promise<PrivateMessagePage>;
  send: (friendId: string, text: string, id: string) => Promise<PrivateMessage>;
};
export class PrivateMessagesError extends Error {
  constructor(message: string, readonly unavailable = false) {
    super(message);
    this.name = "PrivateMessagesError";
  }
}
const errors: Record<string, string> = {
  AUTH_REQUIRED: "Sign in again to view your messages.",
  MESSAGES_UNAVAILABLE: "This conversation is no longer available.",
  MESSAGE_INVALID: "Write a message between 1 and 2,000 characters.",
  MESSAGE_RATE_LIMITED: "Please wait a moment before sending another message.",
  MESSAGE_CONFLICT: "This message couldn't be sent. Close the conversation and try again."
};
function fail(error: { message: string }): never {
  throw new PrivateMessagesError(
    errors[error.message] ?? "Messages are temporarily unavailable. Please try again.",
    error.message === "MESSAGES_UNAVAILABLE" || error.message === "AUTH_REQUIRED"
  );
}
export const livePrivateMessages: PrivateMessagesAdapter = {
  list: async (friendId, cursor) => {
    const { data, error } = await readRequest(signal =>
      createClient().rpc("get_private_messages", {
        p_friend_id: friendId,
        p_before: cursor?.at ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: 40
      }).abortSignal(signal)
    );
    if (error) fail(error);
    return data as PrivateMessagePage;
  },
  send: async (friendId, text, id) => {
    const { data, error } = await createClient().rpc("send_private_message", {
      p_friend_id: friendId, p_body: text, p_id: id
    });
    if (error) fail(error);
    return data as PrivateMessage;
  }
};
