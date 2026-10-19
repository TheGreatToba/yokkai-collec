import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
if (
  url.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "54321"
)
  throw Error("A local Supabase instance on port 54321 is required");
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
};
const admin = createClient(
  url.origin,
  process.env.SUPABASE_SECRET_KEY,
  options
);
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const created = [];
try {
  const players = [];
  for (const label of ["Alice", "Bob", "Outsider"]) {
    const token = randomBytes(6).toString("hex");
    const password = randomBytes(24).toString("base64url");
    const email = `messages-${token}@example.test`;
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { pseudo: `Msg${label}${token}` }
    });
    if (result.error) throw result.error;
    created.push(result.data.user.id);
    const client = createClient(url.origin, publicKey, options);
    const session = await client.auth.signInWithPassword({ email, password });
    if (session.error) throw session.error;
    players.push({ id: result.data.user.id, client });
  }
  const [alice, bob, outsider] = players;
  const request = await alice.client.rpc("send_friend_request", {
    p_friend_id: bob.id
  });
  if (request.error) throw request.error;
  const accepted = await bob.client.rpc("respond_friend_request", {
    p_request_id: request.data,
    p_accept: true
  });
  if (accepted.error) throw accepted.error;
  const id = randomUUID();
  const args = {
    p_friend_id: bob.id,
    p_body: "Local private message proof",
    p_id: id
  };
  const [sent, repeated] = await Promise.all([
    alice.client.rpc("send_private_message", args),
    alice.client.rpc("send_private_message", args)
  ]);
  if (sent.error) throw sent.error;
  assert.equal(sent.data.senderId, alice.id);
  assert.equal(repeated.data?.id, id);
  const received = await bob.client.rpc("get_private_messages", {
    p_friend_id: alice.id
  });
  if (received.error) throw received.error;
  assert.equal(received.data.items.length, 1);
  assert.equal(received.data.items[0].id, id);
  const denied = await outsider.client.rpc("get_private_messages", {
    p_friend_id: alice.id
  });
  assert.equal(denied.error?.message, "MESSAGES_UNAVAILABLE");
  const direct = await bob.client.from("private_messages").select("*");
  assert.ok(direct.error);
  const blocked = await bob.client.rpc("block_user", { p_user_id: alice.id });
  if (blocked.error) throw blocked.error;
  const afterBlock = await alice.client.rpc("get_private_messages", {
    p_friend_id: bob.id
  });
  assert.equal(afterBlock.error?.message, "MESSAGES_UNAVAILABLE");
  console.log(
    "Local Supabase proof passed: authenticated send, receive, idempotent retry, outsider denial, no direct table access, and bilateral block."
  );
} finally {
  for (const id of created) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw result.error;
  }
  console.log(
    `Removed ${created.length} disposable local test accounts and their messages.`
  );
}
