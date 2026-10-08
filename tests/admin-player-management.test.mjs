import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("le panneau admin sépare les cartes et les joueurs", async () => {
  const nav = await read("app/admin/admin-navigation.tsx");
  const cards = await read("app/admin/cards/page.tsx");
  const players = await read("app/admin/players/page.tsx");
  assert.match(nav, /\/admin\/cards/); assert.match(nav, /\/admin\/players/);
  assert.match(nav, /border-cyan-400 bg-cyan-400\/10 text-cyan-200/);
  assert.match(cards, /<AdminNavigation/); assert.match(players, /<AdminNavigation/);
  assert.match(players, /admin_list_players/); assert.match(players, /admin_get_player/);
});

test("les données joueurs et le bannissement restent derrière des RPC admin", async () => {
  const migration = await read("supabase/migrations/20261009000000_admin_player_management.sql");
  for (const rpc of ["admin_list_players", "admin_get_player", "admin_set_user_ban", "admin_remove_player_card"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
  }
  assert.equal((migration.match(/if not public\.is_current_user_admin\(\)/g) ?? []).length, 4);
  assert.match(migration, /CANNOT_BAN_SELF/); assert.match(migration, /CANNOT_BAN_ADMIN/);
  assert.match(migration, /update auth\.users set banned_until/);
  assert.match(migration, /delete from auth\.sessions/);
  assert.match(migration, /CARD_IN_TRADE/); assert.match(migration, /player\.card\.remove/);
  assert.match(migration, /perform public\.credit_karas\(sale\.buyer_id,sale\.current_price\)/);
  assert.match(migration, /from auth\.users u left join public\.user_profiles/);
  assert.match(migration, /player\.ban/); assert.match(migration, /player\.unban/);
  assert.match(migration, /revoke all on function[\s\S]+from public,anon,authenticated/);
});

test("la fiche joueur affiche son inventaire et confirme la modération", async () => {
  const manager = await read("app/admin/players/player-manager.tsx");
  const actions = await read("app/admin/players/actions.ts");
  const collection = await read("components/collection.tsx");
  assert.match(manager, /<CollectionView/); assert.match(manager, /yk-friend-collection-modal/);
  assert.match(manager, /readOnly adminRemoval onDiscard=\{removeCard\}/);
  assert.match(manager, /title=\{player\.isBanned \? "Débannir ce joueur \?" : "Bannir ce joueur \?"\}/);
  assert.match(actions, /requireAdminAction\(\)/); assert.match(actions, /admin_set_user_ban/);
  assert.match(actions, /admin_remove_player_card/);
  assert.match(collection, /adminRemoval \? false/);
  assert.match(collection, /Le retrait administratif annulera aussi la vente et remboursera automatiquement/);
  assert.doesNotMatch(manager + actions, /SERVICE_ROLE|SECRET_KEY|createAdminClient/);
});
