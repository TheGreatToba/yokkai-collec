// Exact overloads and roles only. Every addition requires an access justification.
const allowlist = {
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
  "public.create_trade_offer(uuid, uuid[], integer, uuid[], integer, uuid)": [
    "authenticated"
  ], // Player proposes a validated trade with owned assets.
  "public.delete_card_share(text)": ["authenticated"], // Owner revokes their card share.
  "public.delete_folder(uuid)": ["authenticated"], // Owner removes their folder.
  "public.discard_collection_card(uuid)": ["authenticated"], // Player discards their own eligible card.
  "public.discard_decision_pack_card(uuid)": ["authenticated"], // Player discards their own decision pack choice.
  "public.discard_regular_pack_card(uuid)": ["authenticated"], // Player discards their own regular pack card.
  "public.evolve_ssr_card(uuid[])": ["authenticated"], // Player evolves validated owned copies.
  "public.get_achievements()": ["authenticated"], // Reads the current player's achievement progress.
  "public.get_auction(uuid)": ["authenticated"], // Marketplace detail with viewer access checks.
  "public.get_auction_chat(uuid)": ["authenticated"], // Auction chat read checks viewer eligibility.
  "public.get_card_discovery(uuid, integer, integer)": ["authenticated"], // Discovery exposes permitted collector information.
  "public.get_decision_pack_status()": ["authenticated"], // Reads the current player's pack state.
  "public.get_friend_collection(uuid)": ["authenticated"], // Collection read enforces friendship and privacy.
  "public.get_friendships()": ["authenticated"], // Reads the current player's social relationships.
  "public.get_friendships_page(jsonb, integer)": ["authenticated"], // Bounded pages only expose auth.uid() relationships, preserving the existing privacy and ordering.
  "public.get_game_info()": ["authenticated"], // Narrow access to the current player's balance and game state.
  "public.get_my_active_auction_cards()": ["authenticated"], // Reads the current player's auctioned cards.
  "public.get_pack_destruction_values(uuid[])": ["authenticated"], // Estimates rewards for the player's eligible cards.
  "public.get_profile(text)": ["authenticated"], // Profile view applies viewer privacy rules.
  "public.get_profile_privacy()": ["authenticated"], // Reads the current player's privacy setting.
  "public.get_public_profile(uuid)": ["authenticated"], // Exposes the permitted public profile projection.
  "public.get_regular_pack_status()": ["authenticated"], // Reads the current player's pack timers.
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
