import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

const migration = "20261015000008_ssr_evolution_ur.sql";
const directory = new URL("../supabase/migrations/", import.meta.url);
const alice = "86000000-0000-4000-8000-000000000001";
const bob = "86000000-0000-4000-8000-000000000002";

test("UR evolution preserves legacy copies and all owned-card read models", async t => {
  const before = readdirSync(directory)
    .filter(n => n.endsWith(".sql") && n < migration)
    .sort();
  const { db } = await replayMigrations({ migrations: before });
  t.after(() => db.close());
  for (const [id, pseudo] of [
    [alice, "UrAlice"],
    [bob, "UrBob"]
  ])
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)",
      [id, JSON.stringify({ pseudo })]
    );
  await db.exec(
    "update public.user_profiles set is_public=true,karas_balance=10000"
  );
  const card = (
    await db.query(
      "insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source) values ('ur-fixture','Fusion','ANIME/MANGA','UR Test','SSR','https://i.imgur.com/ur.png','test') returning id"
    )
  ).rows[0].id;
  const legacy = (
    await db.query(
      "insert into public.user_cards(user_id,card_id,rarity,is_shiny,is_evolved) values ($1,$2,'SSR',true,true) returning *",
      [alice, card]
    )
  ).rows[0];
  await db.exec(readFileSync(new URL(migration, directory), "utf8"));
  assert.deepEqual(
    (await db.query("select * from public.user_cards where id=$1", [legacy.id]))
      .rows[0],
    legacy
  );
  assert.equal(
    (await db.query("select rarete_base from public.cards where id=$1", [card]))
      .rows[0].rarete_base,
    "SSR"
  );

  async function rpc(user, sql, args = []) {
    await db.exec("set role authenticated");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user
      ]);
      return (await db.query(sql, args)).rows[0]?.value;
    } finally {
      await db.exec("reset role");
    }
  }
  const copies = async (user = alice, amount = 5) =>
    (
      await db.query(
        "insert into public.user_cards(user_id,card_id,rarity) select $1,$2,'SSR' from generate_series(1,$3) returning id",
        [user, card, amount]
      )
    ).rows.map(r => r.id);
  const evolve = ids =>
    rpc(alice, "select public.evolve_ssr_card($1::uuid[]) value", [ids]);
  let ur;
  await t.test(
    "exactly five selected copies become a non-shiny UR; other copies and art remain",
    async () => {
      const chosen = await copies();
      const preserved = (
        await db.query(
          "insert into public.user_cards(user_id,card_id,rarity,custom_image_url) values ($1,$2,'SSR','https://i.imgur.com/keep.png') returning *",
          [alice, card]
        )
      ).rows[0];
      ur = await evolve(chosen);
      assert.equal(ur.rarity, "UR");
      assert.equal(ur.shiny, false);
      assert.equal(ur.isEvolved, true);
      assert.equal(ur.id, card);
      assert.equal(ur.anime, "UR Test");
      assert.equal(ur.folderId, null);
      assert.equal(ur.customImageUrl, null);
      assert.equal(ur.image, "https://i.imgur.com/ur.png");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.user_cards where id=any($1::uuid[])",
            [chosen]
          )
        ).rows[0].n,
        0
      );
      assert.deepEqual(
        (
          await db.query("select * from public.user_cards where id=$1", [
            preserved.id
          ])
        ).rows[0],
        preserved
      );
      assert.deepEqual(
        (
          await db.query(
            "select rarity,is_shiny,is_evolved from public.user_cards where id=$1",
            [ur.instanceId]
          )
        ).rows[0],
        { rarity: "UR", is_shiny: false, is_evolved: true }
      );
      await assert.rejects(evolve(chosen), /SSR_CARD_NOT_OWNED/);
    }
  );
  await t.test(
    "invalid counts, duplicates, foreign, shiny, evolved, locked and frozen copies consume nothing",
    async () => {
      const ids = await copies();
      const foreign = (await copies(bob, 1))[0];
      const otherCard = (
        await db.query(
          "insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source) values ('ur-other','Other SSR','ANIME/MANGA','Other','SSR','https://i.imgur.com/other.png','test') returning id"
        )
      ).rows[0].id;
      const otherCopy = (
        await db.query(
          "insert into public.user_cards(user_id,card_id,rarity) values ($1,$2,'SSR') returning id",
          [alice, otherCard]
        )
      ).rows[0].id;
      for (const invalid of [
        null,
        ids.slice(0, 4),
        [ids[0], ids[0], ...ids.slice(1, 4)],
        [...ids.slice(0, 4), foreign],
        [...ids.slice(0, 4), otherCopy],
        [...ids.slice(0, 4), legacy.id],
        [...ids.slice(0, 4), ur.instanceId]
      ]) {
        await assert.rejects(
          evolve(invalid),
          /FIVE_DISTINCT_SSR_COPIES_REQUIRED|INVALID_SSR_COPIES/
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.user_cards where id=any($1::uuid[])",
              [ids]
            )
          ).rows[0].n,
          5
        );
      }
      await db.query(
        "update public.user_cards set is_locked=true where id=$1",
        [ids[0]]
      );
      await assert.rejects(evolve(ids), /CARD_LOCKED/);
      await db.query(
        "update public.user_cards set is_locked=false where id=$1",
        [ids[0]]
      );
      const sale = await rpc(
        alice,
        "select public.create_auction($1,10,15) value",
        [ids[0]]
      );
      await assert.rejects(evolve(ids), /CARD_FROZEN/);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.user_cards where id=any($1::uuid[])",
            [ids]
          )
        ).rows[0].n,
        5
      );
      await db.query(
        "update public.auctions set status='expired' where id=$1",
        [sale]
      );
    }
  );
  await t.test(
    "UR stays UR in profiles, friend collections, trades, sharing and auctions",
    async () => {
      assert.equal(
        (
          await rpc(bob, "select public.get_friend_collection($1) value", [
            alice
          ])
        ).find(c => c.instanceId === ur.instanceId).rarity,
        "UR"
      );
      const trade = (
        await db.query("select public.trade_card_json($1::uuid[]) value", [
          [ur.instanceId]
        ])
      ).rows[0].value;
      assert.equal(trade[0].rarity, "UR");
      const details = await rpc(
        bob,
        "select public.get_profile_details($1::text) value",
        [alice]
      );
      assert.equal(
        details.activity.find(x => x.card.instanceId === ur.instanceId).card
          .rarity,
        "UR"
      );
      const share = await rpc(
        alice,
        "select public.create_card_share($1) value",
        [ur.instanceId]
      );
      const normal = (await copies(alice, 1))[0];
      const ssrShare = await rpc(
        alice,
        "select public.create_card_share($1) value",
        [normal]
      );
      assert.notEqual(share, ssrShare);
      assert.equal(
        (
          await db.query("select rarity from public.card_shares where id=$1", [
            share
          ])
        ).rows[0].rarity,
        "UR"
      );
      const sale = await rpc(
        alice,
        "select public.create_auction($1,10,15) value",
        [ur.instanceId]
      );
      assert.equal(
        (await rpc(bob, "select public.get_auction($1) value", [sale])).card
          .rarity,
        "UR"
      );
      assert.equal(
        (await rpc(bob, "select public.list_auctions() value")).find(
          x => x.id === sale
        ).card.rarity,
        "UR"
      );
      assert.equal(
        (await rpc(bob, "select public.list_auctions_page() value")).items.find(
          x => x.id === sale
        ).card.rarity,
        "UR"
      );
      assert.equal(
        (
          await rpc(
            bob,
            "select public.get_profile_active_auctions($1) value",
            [alice]
          )
        ).items.find(x => x.id === sale).card.rarity,
        "UR"
      );
      await db.query(
        "update public.auctions set status='expired' where id=$1",
        [sale]
      );
    }
  );
  await t.test(
    "failure when creating the UR rolls back the five deletions and achievement updates",
    async () => {
      const ids = await copies();
      const stats = (
        await db.query(
          "select to_jsonb(s) value from public.user_achievement_stats s where user_id=$1",
          [alice]
        )
      ).rows[0].value;
      await db.exec(
        "create function public.ur_test_abort() returns trigger language plpgsql as $$begin raise exception 'UR_TEST_ABORT'; end;$$; create trigger ur_test_abort before insert on public.user_cards for each row when(new.rarity='UR') execute function public.ur_test_abort();"
      );
      try {
        await assert.rejects(evolve(ids), /UR_TEST_ABORT/);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.user_cards where id=any($1::uuid[])",
              [ids]
            )
          ).rows[0].n,
          5
        );
        assert.deepEqual(
          (
            await db.query(
              "select to_jsonb(s) value from public.user_achievement_stats s where user_id=$1",
              [alice]
            )
          ).rows[0].value,
          stats
        );
      } finally {
        await db.exec(
          "drop trigger ur_test_abort on public.user_cards; drop function public.ur_test_abort();"
        );
      }
    }
  );
  await t.test(
    "UR rarity survives an accepted trade and a settled auction",
    async () => {
      const transferred = await evolve(await copies());
      await db.query(
        "insert into public.friendships(user_id,friend_id,status) values ($1,$2,'accepted')",
        [alice, bob]
      );
      const offer = await rpc(
        alice,
        "select public.create_trade_offer($1,$2::uuid[]) value",
        [bob, [transferred.instanceId]]
      );
      await rpc(bob, "select public.respond_trade_offer($1,'accept') value", [
        offer
      ]);
      assert.deepEqual(
        (
          await db.query(
            "select user_id,rarity,is_shiny from public.user_cards where id=$1",
            [transferred.instanceId]
          )
        ).rows[0],
        { user_id: bob, rarity: "UR", is_shiny: false }
      );
      const sale = await rpc(
        bob,
        "select public.create_auction($1,10,15) value",
        [transferred.instanceId]
      );
      await rpc(alice, "select public.place_bid($1,20) value", [sale]);
      await db.query(
        "update public.auctions set ends_at=clock_timestamp()-interval '1 second' where id=$1",
        [sale]
      );
      await db.exec("select public.settle_expired_auctions()");
      assert.deepEqual(
        (
          await db.query(
            "select user_id,rarity,is_shiny from public.user_cards where id=$1",
            [transferred.instanceId]
          )
        ).rows[0],
        { user_id: alice, rarity: "UR", is_shiny: false }
      );
      await db.query(
        "delete from public.friendships where user_id=$1 and friend_id=$2",
        [alice, bob]
      );
    }
  );
  await t.test(
    "binder UR filter is bounded to owned URs and respects privacy",
    async () => {
      const page = await rpc(
        bob,
        "select public.get_friend_panini_album_cards_page($1,'UR Test','','',false,0,28,'UR') value",
        [alice]
      );
      assert.equal(page.total, 1);
      assert.equal(page.items[0].rarity, "UR");
      assert.equal(page.items[0].owned, true);
      assert.equal(
        (
          await rpc(
            bob,
            "select public.get_panini_album_cards_page('UR Test','','',false,0,28,'UR') value"
          )
        ).total,
        0
      );
      await db.query(
        "update public.user_profiles set is_public=false where user_id=$1",
        [alice]
      );
      await assert.rejects(
        rpc(
          bob,
          "select public.get_friend_panini_album_cards_page($1,'UR Test','','',false,0,28,'UR') value",
          [alice]
        ),
        /PROFILE_PRIVATE/
      );
      await db.query(
        "update public.user_profiles set is_public=true where user_id=$1",
        [alice]
      );
    }
  );
  await t.test(
    "UR has no booster drop and cannot be a catalogue base rarity or player-minted",
    async () => {
      const info = await rpc(alice, "select public.get_game_info() value");
      assert.deepEqual(info.rarities, ["C", "R", "SR", "SSR", "UR", "LR"]);
      assert.equal(
        info.dropRates.some(x => x.rarity === "UR"),
        false
      );
      assert.equal(
        info.decisionDropRates.some(x => x.rarity === "UR"),
        false
      );
      await assert.rejects(
        db.query("update public.cards set rarete_base='UR' where id=$1", [
          card
        ]),
        /cards_no_ur_base_check/
      );
      await assert.rejects(
        db.query(
          "insert into public.user_cards(user_id,card_id,rarity) values ($1,$2,'UR')",
          [alice, card]
        ),
        /user_cards_ur_evolved_check/
      );
      await assert.rejects(
        rpc(
          alice,
          "insert into public.user_cards(user_id,card_id,rarity,is_evolved) values ($1,$2,'UR',true)",
          [alice, card]
        ),
        /permission denied/
      );
      assert.equal(
        (await db.query("select public.card_destruction_value('UR') value"))
          .rows[0].value,
        4
      );
      const start = (
        await db.query(
          "select karas_balance from public.user_profiles where user_id=$1",
          [alice]
        )
      ).rows[0].karas_balance;
      assert.equal(
        await rpc(alice, "select public.discard_collection_card($1) value", [
          ur.instanceId
        ]),
        start + 4
      );
    }
  );
});
