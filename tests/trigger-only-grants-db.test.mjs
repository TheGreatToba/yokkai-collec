import assert from "node:assert/strict";
import test from "node:test";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

const functions = [
  "on_profile_create_achievement_stats",
  "on_card_acquired_achievements",
  "on_decision_pack_completed_achievement",
  "on_auction_won_achievement",
  "on_trade_completed_achievement",
];
const alice = "10000000-0000-4000-8000-000000000001";
const bob = "10000000-0000-4000-8000-000000000002";

async function authenticated(db, id, sql, params = []) {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    assert.deepEqual((await db.query("select current_user as role,auth.uid() as uid")).rows,
      [{ role: "authenticated", uid: id }]);
    return (await db.query(sql, params)).rows[0]?.result;
  } finally { await db.exec("reset role"); }
}

async function completed(db, player, achievement) {
  const achievements = await authenticated(db, player, "select public.get_achievements() as result");
  assert.ok(achievements.find(a => a.id === achievement)?.completedAt, achievement);
}

test("trigger-only EXECUTE is denied to PUBLIC, anon and authenticated", async t => {
  const { db } = await replayMigrations(); t.after(() => db.close());
  for (const name of functions) {
    for (const role of ["public", "anon", "authenticated"]) {
      const { allowed } = (await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed",
        [role, `public.${name}()`])).rows[0];
      assert.equal(allowed, false, `${role} must not execute ${name}`);
    }
    await assert.rejects(authenticated(db, alice, `select public.${name}()`), { code: "42501" });
  }
});

test("authenticated actions still fire all five achievement triggers", async t => {
  const { db } = await replayMigrations(); t.after(() => db.close());

  // Only the disposable Auth stub gets INSERT: simulate signup through its real
  // trigger chain as authenticated, without opening any public application table.
  await db.exec("grant insert on auth.users to authenticated");
  for (const [id, pseudo] of [[alice, "TriggerAlice"], [bob, "TriggerBob"]]) {
    await authenticated(db, id, "insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)",
      [id, JSON.stringify({ pseudo })]);
  }
  await db.exec("revoke insert on auth.users from authenticated");
  assert.equal((await db.query("select has_table_privilege('authenticated','public.user_profiles','INSERT') as allowed")).rows[0].allowed, false);
  // Inspect immediately: later RPCs also initialize stats and could mask a broken signup trigger.
  assert.deepEqual((await db.query("select user_id from public.user_achievement_stats order by user_id")).rows,
    [{ user_id: alice }, { user_id: bob }]);

  // Catalogue and balances are fixtures; every achievement-producing action below
  // is issued under authenticated, through the production RPCs.
  await db.exec("update public.user_profiles set karas_balance=100");
  for (const rarity of ["C", "R", "SR", "SSR", "LR"]) {
    await db.query("insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source) values ($1,$1,$1,'Triggers',$2,'https://example.test/card.png','test')",
      [`trigger-${rarity}`, rarity]);
  }
  const pack = await authenticated(db, alice, "select public.open_regular_pack() as result");
  assert.equal(pack.length, 5);
  // Each category has one card: any roll completes the collection achievement.
  await completed(db, alice, "specialiste");
  await completed(db, alice, "premier-rituel");

  const choices = await authenticated(db, alice, "select public.open_decision_pack() as result");
  await authenticated(db, alice, "select public.keep_decision_pack_card($1) as result", [choices[0].instanceId]);
  await completed(db, alice, "decision-decisive");

  const friendship = await authenticated(db, alice, "select public.send_friend_request($1) as result", [bob]);
  await authenticated(db, bob, "select public.respond_friend_request($1,true) as result", [friendship]);
  const trade = await authenticated(db, alice, "select public.create_trade_offer($1,$2::uuid[]) as result", [bob, [pack[0].instanceId]]);
  await authenticated(db, bob, "select public.respond_trade_offer($1,'accept') as result", [trade]);
  await completed(db, alice, "marche-conclu");
  await completed(db, bob, "marche-conclu");
  await completed(db, bob, "specialiste");

  const auction = await authenticated(db, alice, "select public.create_auction($1,10,15) as result", [pack[1].instanceId]);
  await authenticated(db, bob, "select public.place_bid($1,20) as result", [auction]);
  // Move the clock only; do not set sold or invoke settlement as postgres.
  await db.query("update public.auctions set ends_at=now()-interval '1 minute' where id=$1", [auction]);
  // create_auction still settles expired auctions inside the real player RPC.
  await authenticated(db, alice, "select public.create_auction($1,10,15) as result", [pack[2].instanceId]);
  await completed(db, bob, "adjuge");
  assert.equal((await db.query("select status from public.auctions where id=$1", [auction])).rows[0].status, "sold");
  assert.equal((await db.query("select user_id from public.user_cards where id=$1", [pack[1].instanceId])).rows[0].user_id, bob);
});
