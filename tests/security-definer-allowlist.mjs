// Exact overloads and roles only. Every addition requires an access justification.
export const ownerOnly = [
  "public.notify_wall_post_reply()",
  "public.cleanup_wall_reply_notifications()",
  "public.prepare_account_deletion_without_billing(uuid)",
  "public.build_data_export_without_wall_interactions(uuid, uuid)",
  "public.wall_actor_visible(uuid)",
  "public.wall_interaction_owner(uuid)",
  "public.cleanup_wall_interactions()",
  "public.get_wall_post_activity_without_reactions(uuid, timestamp with time zone, uuid)",
  "public.build_data_export_without_reactions(uuid, uuid)",
  "public.cleanup_wall_reactions()"
]; // Internal helpers: owning SECURITY DEFINER wrappers/triggers only, never service_role or players.

const allowlist = {
  "public.get_home_wall_feed(timestamp with time zone, uuid, integer)": [
    "authenticated"
  ], // Home timeline: auth.uid()'s own wall plus accepted friends, same live wall ACL, bans/deletion fences and bounded cursor. Walid review required.
  "public.set_wall_post_reaction(uuid, text, boolean)": ["authenticated"], // Allowed emoji only, own desired state, live friend/self post ACL, serialized maximum 8 reactions per post. Walid review required.
  "public.get_wall_post_activity(uuid, timestamp with time zone, uuid)": [
    "authenticated"
  ], // Accepted friend/self post; live wall ACL and filtered reply authors, bounded page. Walid review required.
  "public.set_wall_post_like(uuid, boolean)": ["authenticated"], // Idempotent desired state for auth.uid() only; same post ACL.
  "public.publish_wall_post_reply(uuid, uuid, text)": ["authenticated"], // Own bounded text reply, idempotent UUID, serialized rate limit, same post ACL.
  "public.delete_wall_post_reply(uuid, uuid)": ["authenticated"], // Only auth.uid()'s own reply on an accessible post.
  "public.get_friend_wall_feed(timestamp with time zone, uuid, integer)": [
    "authenticated"
  ], // Bounded accepted-friend wall feed for auth.uid(); existing wall ACL, bilateral blocks, bans and deletion fences. Requires Walid ACL review before production.
  "public.get_recent_big_pulls(integer)": ["authenticated"], // Bounded public pulls; private identity/appearance are null, blocked/banned/deleted players excluded.
  "public.browse_auctions_page(integer, text, text, text, text, text)": [
    "authenticated"
  ], // Bounded market prefixes, same viewer visibility as list_auctions_page; no anonymous access. Requires Walid ACL review.
  "public.admin_get_player(uuid)": ["authenticated"], // Admin-only account and inventory projection.
  "public.admin_list_players(text, integer, integer)": ["authenticated"], // Admin-only paginated account search.
  "public.admin_remove_player_card(uuid)": ["authenticated"], // Admin-only removal of one owned copy, including safe auction cancellation.
  "public.admin_set_user_ban(uuid, boolean)": ["authenticated"], // Admin-only moderation action with self/admin protection.
  "public.admin_search_reports(text, text, integer, integer)": [
    "authenticated"
  ], // Admin-only enriched report dashboard.
  "public.admin_search_card_reports(text, text, integer, integer)": [
    "authenticated"
  ], // Admin-only catalogue report dashboard.
  "public.admin_card_reference_counts(uuid)": ["authenticated"], // Admin RPC checks administrator status before reading references.
  "public.admin_delete_card(uuid)": ["authenticated"], // Admin-only atomic catalogue deletion cleans owned copies and related activity.
  "public.admin_delete_cards(uuid[])": ["authenticated"], // Admin-only atomic bulk deletion; same internal helper as admin_delete_card.
  "public.admin_preview_delete_cards(uuid[])": ["authenticated"], // Admin-only read-only impact preview before bulk deletion.
  "public.admin_list_reports(text, integer, integer)": ["authenticated"], // Moderation RPC checks administrator status.
  "public.admin_set_report_status(uuid, text)": ["authenticated"], // Moderation update checks administrator status.
  "public.admin_set_card_report_status(uuid, text)": ["authenticated"], // Card moderation update checks administrator status.
  "public.block_user(uuid)": ["authenticated"], // Player can block users for their own account.
  "public.cancel_auction(uuid)": ["authenticated"], // Seller can cancel their own eligible auction.
  "public.cancel_trade_offer(uuid)": ["authenticated"], // Participant can cancel their own eligible trade.
  "public.claim_achievement(text)": ["authenticated"], // Player claims their own completed achievement reward.
  "public.create_auction(uuid, integer, integer)": ["authenticated"], // Player lists an owned eligible card.
  "public.create_card_share(uuid, boolean)": ["authenticated"], // Player shares their own card.
  "public.create_folder(text)": ["authenticated"], // Player creates their own collection folder.
  "public.create_referral_code()": ["authenticated"], // Creates or returns only auth.uid()'s opaque referral code.
  "public.create_trade_offer(uuid, uuid[], integer, uuid[], integer, uuid)": [
    "authenticated"
  ], // Player proposes a validated trade with owned assets.
  "public.delete_card_share(text)": ["authenticated"], // Owner revokes their card share.
  "public.delete_folder(uuid)": ["authenticated"], // Owner removes their folder.
  "public.discard_collection_card(uuid)": ["authenticated"], // Player discards their own eligible card.
  "public.discard_collection_cards(uuid[])": ["authenticated"], // Player atomically discards one validated batch of their own cards.
  "public.discard_decision_pack_card(uuid)": ["authenticated"], // Player discards their own decision pack choice.
  "public.discard_regular_pack_card(uuid)": ["authenticated"], // Player discards their own regular pack card.
  "public.evolve_ssr_card(uuid[])": ["authenticated"], // Player evolves validated owned copies.
  "public.get_achievements()": ["authenticated"], // Reads the current player's achievement progress.
  "public.get_auction(uuid)": ["authenticated"], // Marketplace detail with viewer access checks.
  "public.get_auction_chat(uuid)": ["authenticated"], // Auction chat read checks viewer eligibility.
  "public.get_card_discovery(uuid, integer, integer)": ["authenticated"], // Discovery exposes permitted collector information.
  "public.get_decision_pack_status()": ["authenticated"], // Reads the current player's pack state.
  "public.get_friend_collection(uuid)": ["authenticated"], // Collection read enforces friendship and privacy.
  "public.get_friend_panini_album_cards_page(uuid, text, text, text, boolean, integer, integer)":
    ["authenticated"], // Panini card progress enforces the same collection privacy before reading another player.
  "public.get_friend_panini_album_cards_page(uuid, text, text, text, boolean, integer, integer, text)":
    ["authenticated"], // Rarity-filtered pages retain collection privacy and expose only the requested owner's progress.
  "public.get_friend_panini_albums_page(uuid, text, text, integer, integer)": [
    "authenticated"
  ], // Panini album progress enforces the same collection privacy before reading another player.
  "public.get_friendships()": ["authenticated"], // Reads the current player's social relationships.
  "public.get_friendships_page(jsonb, integer)": ["authenticated"], // Bounded pages only expose auth.uid() relationships, preserving the existing privacy and ordering.
  "public.get_game_info()": ["authenticated"], // Narrow access to the current player's balance and game state.
  "public.get_my_active_auction_cards()": ["authenticated"], // Reads the current player's auctioned cards.
  "public.get_pack_destruction_values(uuid[])": ["authenticated"], // Estimates rewards for the player's eligible cards.
  "public.get_profile(text)": ["authenticated"], // Profile view applies viewer privacy rules.
  "public.can_read_profile_wall(uuid)": ["authenticated"], // RLS helper uses auth.uid(); dynamic profile privacy, accepted friends, bilateral blocks and deletion fence.
  "public.get_profile_wall(uuid, timestamp with time zone, uuid, integer)": [
    "authenticated"
  ], // Bounded keyset pages of permitted wall posts only; no anon or private-wall bypass.
  "public.get_private_messages(uuid, timestamp with time zone, uuid, integer)":
    ["authenticated"], // Only auth.uid() and an accepted, unblocked friend; bounded conversation pages.
  "public.get_social_unread()": ["authenticated"], // Only auth.uid() unread aggregates; accepted, unblocked conversations and valid incoming requests.
  "public.mark_private_messages_read(uuid, uuid)": ["authenticated"], // Only auth.uid(); verifies incoming message ownership, social/deletion locks and monotonic read watermark.
  "public.send_private_message(uuid, text, uuid)": ["authenticated"], // Sender is auth.uid(); accepted friendship, blocks, deletion fence, rate limit and idempotency checked server-side.
  "public.send_private_message_gif(uuid, text, uuid, text)": ["authenticated"], // Same conversation authorization, shared sender limits and idempotency; only allowlisted HTTPS GIPHY media URLs, no uploads.
  "public.publish_profile_wall_post(uuid, text, text, text)": ["authenticated"], // Idempotent own posts only, bounded text/rate/count and owner-scoped private media.
  "public.delete_profile_wall_post(uuid)": ["authenticated"], // Author deletes only their own post; private attachment cleanup stays owner-scoped.
  "public.get_profile_details(text)": ["authenticated"], // Calls get_profile first; inventory, activity and favorites obey its collection privacy; mutual friends obey friendsVisible.
  "public.get_profile_active_auctions(uuid, jsonb, integer)": ["authenticated"], // Read-only bounded seller feed; collection privacy, bilateral blocks and deletion fences; no new bidding rights.
  "public.get_profile_engagement(uuid)": ["authenticated"], // Authenticated profile lookup; exposes aggregate counts and only the caller's like status, never viewer identities.
  "public.set_profile_like(uuid, boolean)": ["authenticated"], // Idempotent own like only, no self likes; bilateral blocks, unique pair and account deletion guards enforced.
  "public.update_profile_interests(jsonb)": ["authenticated"], // Bounded preferences update only auth.uid() after authenticated profile lookup.
  "public.update_profile_widgets(jsonb)": ["authenticated"], // Only auth.uid(); bounded titles, unique categories from live cards, no inventory writes.
  "public.update_profile_appearance(text, text, uuid[], uuid, text)": [
    "authenticated"
  ], // Reuses update_profile checks atomically; banner URL limited to the caller's avatars/banner raster file on the API origin.
  "public.get_profile_privacy()": ["authenticated"], // Reads the current player's privacy setting.
  "public.update_profile_appearance_framed(text, text, uuid[], uuid, text, jsonb)":
    ["authenticated"], // Own bounded crop metadata only; reuses atomic appearance/URL/deletion checks, no inventory or storage grant. Validated with Walid.
  "public.get_public_profile(uuid)": ["authenticated"], // Exposes the permitted public profile projection.
  "public.get_regular_pack_status()": ["authenticated"], // Reads the current player's pack timers.
  "public.get_referral_status()": ["authenticated"], // Reads only auth.uid()'s code, aggregate rewards and bonus balance.
  "public.get_shared_card(text)": ["anon", "authenticated"], // Public share token intentionally exposes the shared card projection.
  "public.get_trade_context(uuid)": ["authenticated"], // Reads a permitted trading context for the viewer.
  "public.is_current_user_admin()": ["authenticated"], // RLS helper answers only whether the current player is an admin.
  "public.is_pseudo_available(text)": ["anon", "authenticated"], // Signup intentionally exposes only pseudo availability.
  "public.keep_decision_pack_card(uuid)": ["authenticated"], // Player keeps their own eligible pack choice.
  "public.list_admin_card_categories()": ["authenticated"], // Admin catalogue access verifies administrator status.
  "public.list_auctions()": ["authenticated"], // Marketplace listing applies viewer visibility rules.
  "public.list_auctions_page(jsonb, integer)": ["authenticated"], // Bounded marketplace pages retain the current viewer's visibility rules.
  "public.list_blocked_users()": ["authenticated"], // Lists only the current player's blocks.
  "public.list_card_shares(integer)": ["authenticated"], // Lists only the current player's shares.
  "public.list_notifications(integer)": ["authenticated"], // Lists only the current player's notifications.
  "public.list_trade_offers()": ["authenticated"], // Lists trades involving the current player.
  "public.list_trade_offers_page(jsonb, integer)": ["authenticated"], // Bounded trade pages only include offers involving auth.uid().
  "public.list_wishlist(text)": ["authenticated"], // Wishlist read applies viewer privacy rules.
  "public.mark_notification_read(uuid)": ["authenticated"], // Player marks only their own notification.
  "public.mark_offline()": ["authenticated"], // Updates the current player's presence.
  "public.move_card_to_folder(uuid, uuid)": ["authenticated"], // Moves an owned card to an owned folder.
  "public.move_cards_to_folder(uuid[], uuid)": ["authenticated"], // Atomically moves the current player's selected cards to an owned folder.
  "public.open_decision_pack()": ["authenticated"], // Opens the current player's available decision pack.
  "public.open_regular_pack()": ["authenticated"], // Opens the current player's available regular pack.
  "public.place_bid(uuid, integer)": ["authenticated"], // Player bids with validated funds and auction state.
  "public.remove_friend(uuid)": ["authenticated"], // Player removes their own friendship.
  "public.report_user(uuid, text, text, uuid, text, boolean)": [
    "authenticated"
  ], // Creates a validated report under the current player's identity.
  "public.report_card(uuid, text)": ["authenticated"], // Creates a validated catalogue-card report under the current player's identity.
  "public.respond_friend_request(uuid, boolean)": ["authenticated"], // Recipient responds to their own request.
  "public.respond_trade_offer(uuid, text)": ["authenticated"], // Trade participant responds with asset validation.
  "public.search_cards(text, integer)": ["authenticated"], // Game catalogue search for signed-in players.
  "public.search_users(text)": ["authenticated"], // Social search exposes permitted profile fields.
  "public.send_auction_chat_message(uuid, text, text)": ["authenticated"], // Eligible participant posts under their own identity.
  "public.send_friend_request(uuid)": ["authenticated"], // Creates a request from the current player.
  "public.set_card_custom_image(uuid, text)": ["authenticated"], // Updates only the current player's card image.
  "public.set_collection_card_locked(uuid, boolean)": ["authenticated"], // Changes lock state only on owned cards.
  "public.set_profile_privacy(boolean)": ["authenticated"], // Changes only the current player's profile privacy.
  "public.toggle_auction_watch(uuid)": ["authenticated"], // Updates only the current player's watch subscription.
  "public.toggle_wishlist(uuid)": ["authenticated"], // Updates only the current player's wishlist.
  "public.touch_presence()": ["authenticated"], // Refreshes only the current player's presence.
  "public.unblock_user(uuid)": ["authenticated"], // Removes only the current player's block.
  "public.update_profile(text, text, uuid[], uuid)": ["authenticated"] // Updates only the current player's profile and owned showcase cards.
};
export default allowlist;
