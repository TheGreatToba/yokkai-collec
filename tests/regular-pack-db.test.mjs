import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
const charlie = "00000000-0000-0000-0000-000000000003";

test("migrations et Regular Pack exécutés sur PostgreSQL (PGlite)", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Supabase-provided roles and Auth schema, simulated only in this test DB.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  for (const name of ["20260923000000_create_card_schema", "20260923000001_create_signup_profile", "20260923000002_regular_pack", "20260924000000_regular_pack_phase1", "20260924000001_lr_shiny_evolution", "20260924000002_decision_pack", "20260924000003_karas", "20260924000004_collection_improvements", "20260924000005_auctions", "20260924000006_friendships", "20260924000007_trades", "20260924000012_custom_card_images", "20260924000013_reset_custom_image_on_auction", "20260925000000_achievements", "20260925000001_wishlists_notifications", "20260925000002_ssr_shiny_evolution", "20260926000000_discard_karas_rewards", "20260926000001_friend_request_notifications", "20260926000002_decision_pack_auto_karas_and_franchise", "20260926000003_regular_pack_franchise", "20260926000004_card_franchise_presentations"]) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  await db.exec(readFileSync(new URL("../supabase/migrations/20260926000004_card_franchise_presentations.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20260927000000_outbid_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20260927000001_trade_offer_received_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20260927000002_auction_won_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20260927000003_achievement_completed_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20260928000002_pseudo_availability.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20260928000003_pseudo_rules.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261001000000_auction_participation.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261001000001_market_popularity.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261001000002_booster_destruction_estimates.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261002000001_drop_rates_v2.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261002000003_drop_rates_rebalance.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261002000004_get_game_info_security.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261002000005_evolve_ssr_explicit_instances.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261003000001_friend_collection.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261003000003_friend_collection_custom_images.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261003000002_evolve_ssr_five_copies.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users values ($1, '{\"pseudo\":\"Alice\"}'), ($2, '{\"pseudo\":\"Bob\"}'), ($3, '{\"pseudo\":\"Charlie\"}')", [alice, bob, charlie]);
  for (const rarity of ["C", "R", "SR", "SSR", "LR"]) {
    await db.query(`insert into public.cards (source_id, nom, categorie, franchise, rarete_base, image_url, source)
      values ($1::text, $1::text, 'Anime/Manga', 'Franchise', $1::text::public.card_rarity, 'https://storage.example/card.png', 'test')`, [rarity]);
  }
  async function asUser(id, run, role = "authenticated") {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
    try { return await run(); } finally { await db.exec("reset role"); }
  }
  const rpc = async (name) => (await db.query(`select public.${name}() as value`)).rows[0].value;
  const count = async (id) => Number((await db.query("select count(*) as count from public.user_cards where user_id=$1", [id])).rows[0].count);
  const deadline = async (id) => (await db.query("select next_regular_pack_at::text as value from public.user_profiles where user_id=$1", [id])).rows[0].value;

  await t.test("profil créé par trigger, informations réelles et réserve initiale pleine", async () => {
    // Match production hardening: profiles are private, but the narrow RPC stays usable.
    await db.exec("revoke all on table public.user_profiles from public, anon, authenticated");
    const info = await asUser(alice, () => rpc("get_game_info"));
    assert.equal(info.user.id, alice);
    assert.equal(info.user.name, "Alice");
    assert.deepEqual(info.categories, ["Anime/Manga"]);
    assert.deepEqual(info.dropRates.map((r) => r.percent), [71.9, 20, 7, 1, 0.1]);
    assert.equal(info.shinyRate, 0.1);
    assert.equal(info.karasBalance, 0);
    assert.equal((await db.query("select prosecdef from pg_proc where oid='public.get_game_info()'::regprocedure")).rows[0].prosecdef, true);
    await db.exec("grant select on table public.user_profiles to authenticated");
    const status = await asUser(alice, () => rpc("get_regular_pack_status"));
    assert.equal(status.available, 5);
    assert.equal(status.maximum, 5);
    assert.equal(status.nextPackAt, null);
  });

  await t.test("pseudos : disponibilité publique, normalisation et contraintes du trigger", async () => {
    const available = async (pseudo, role = "anon") => asUser(null, async () =>
      (await db.query("select public.is_pseudo_available($1) as value", [pseudo])).rows[0].value, role);
    assert.equal(await available("ALICE"), false);
    assert.equal(await available("  Alice  "), false);
    assert.equal(await available("Yōkai 👺"), true);

    await db.query("insert into auth.users values ($1, $2::jsonb)", [
      "00000000-0000-0000-0000-000000000010",
      JSON.stringify({ pseudo: "  Yōkai 👺  " }),
    ]);
    assert.equal((await db.query("select pseudo from public.user_profiles where user_id=$1", [
      "00000000-0000-0000-0000-000000000010",
    ])).rows[0].pseudo, "Yōkai 👺");

    for (const [index, pseudo, error] of [
      [11, "ab", "PSEUDO_TOO_SHORT"],
      [12, "a".repeat(31), "PSEUDO_TOO_LONG"],
      [13, "a/b", "PSEUDO_INVALID_CHARACTERS"],
      [14, "a\u0007b", "PSEUDO_INVALID_CHARACTERS"],
    ]) {
      await assert.rejects(db.query("insert into auth.users values ($1, $2::jsonb)", [
        `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
        JSON.stringify({ pseudo }),
      ]), new RegExp(error));
    }
  });

  await t.test("Karas : solde initial nul et crédit/débit atomiques réservés au serveur", async () => {
    await assert.rejects(asUser(alice, () => db.query("select public.credit_karas($1, 10)", [alice])), /permission denied/);
    assert.equal((await db.query("select public.credit_karas($1, 100) as balance", [alice])).rows[0].balance, 100);
    assert.equal((await db.query("select public.debit_karas($1, 30) as balance", [alice])).rows[0].balance, 70);
    await assert.rejects(db.query("select public.debit_karas($1, 71)", [alice]), /INSUFFICIENT_KARAS/);
    const balance = Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [alice])).rows[0].karas_balance);
    assert.equal(balance, 70);
    await assert.rejects(db.query("select public.credit_karas($1, 0)", [alice]), /INVALID_KARAS_AMOUNT/);
  });

  await t.test("succès : catalogue complet, progression ciblée et réclamation atomique", async () => {
    const initial = await asUser(charlie, () => rpc("get_achievements"));
    assert.equal(initial.length, 11);
    assert.equal(initial.find(item => item.id === "premier-rituel").progressCurrent, 0);
    const before = Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [charlie])).rows[0].karas_balance);
    await asUser(charlie, () => rpc("open_regular_pack"));
    const progressed = await asUser(charlie, () => rpc("get_achievements"));
    const first = progressed.find(item => item.id === "premier-rituel");
    assert.ok(first.completedAt);
    assert.equal(first.claimedAt, null);
    assert.equal(first.progressCurrent, 1);
    const claim = (await asUser(charlie, () => db.query("select public.claim_achievement('premier-rituel') as value"))).rows[0].value;
    assert.equal(claim.balance, before + 10);
    await assert.rejects(asUser(charlie, () => db.query("select public.claim_achievement('premier-rituel')")), /ACHIEVEMENT_ALREADY_CLAIMED/);
    assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [charlie])).rows[0].karas_balance), before + 10);
  });

  await t.test("5 exemplaires indépendants par pack, LR et Shiny valides, puis blocage", async () => {
    const regularPackDefinition = (await db.query("select pg_get_functiondef('public.open_regular_pack()'::regprocedure) as value")).rows[0].value;
    assert.match(regularPackDefinition, /rarete_base\s*=\s*'LR'\s+and\s+random\(\)\s*<\s*(?:0)?\.001/i);
    assert.match(regularPackDefinition, /roll<\.719 then 1 when roll<\.919 then 2 when roll<\.989 then 3 when roll<\.999 then 4 else 5/);
    assert.doesNotMatch(regularPackDefinition, /rarete_base\s+in\s*\(\s*'SSR'\s*,\s*'LR'/i);
    const draw = await asUser(alice, () => rpc("open_regular_pack"));
    assert.equal(draw.length, 5);
    assert.equal(new Set(draw.map((c) => c.instanceId)).size, 5);
    assert.equal(new Set(draw.map((c) => c.obtainedAt)).size, 1);
    assert.ok(draw.every((c) => ["C", "R", "SR", "SSR", "LR"].includes(c.rarity)));
    assert.ok(draw.every((c) => !c.shiny || c.rarity === "LR"));
    assert.ok(draw.every((c) => c.isEvolved === false));
    assert.ok(draw.every((c) => c.isFirstOwner === (c.rarity === "LR")));
    assert.ok(draw.every((c) => c.anime === "Franchise"));
    assert.equal((await asUser(alice, () => rpc("get_regular_pack_status"))).available, 4);
    for (let pack = 0; pack < 4; pack += 1) {
      assert.equal((await asUser(alice, () => rpc("open_regular_pack"))).length, 5);
    }
    assert.equal(await count(alice), 25);
    const previous = await deadline(alice);
    await assert.rejects(asUser(alice, () => rpc("open_regular_pack")), /PACK_NOT_READY/);
    assert.equal(await deadline(alice), previous);
    assert.equal(await count(alice), 25);
  });

  await t.test("régénération : reliquat préservé et plafond strict de cinq packs", async () => {
    await db.query("update public.user_profiles set next_regular_pack_at=clock_timestamp()-interval '15 minutes' where user_id=$1", [alice]);
    const before = Date.parse(await deadline(alice));
    assert.equal((await asUser(alice, () => rpc("get_regular_pack_status"))).available, 2);
    await asUser(alice, () => rpc("open_regular_pack"));
    assert.equal(Date.parse(await deadline(alice)), before + 15 * 60000);
    const partial = await asUser(alice, () => rpc("get_regular_pack_status"));
    assert.equal(partial.available, 1);
    assert.ok(partial.nextPackAt - partial.serverNow > 14 * 60000);
    assert.ok(partial.nextPackAt - partial.serverNow <= 15 * 60000);
    await db.query("update public.user_profiles set next_regular_pack_at=clock_timestamp()-interval '10 days' where user_id=$1", [alice]);
    const full = await asUser(alice, () => rpc("get_regular_pack_status"));
    assert.equal(full.available, 5);
    assert.equal(full.nextPackAt, null);
    await asUser(alice, () => rpc("open_regular_pack"));
    const after = await asUser(alice, () => rpc("get_regular_pack_status"));
    assert.equal(after.available, 4);
    assert.ok(after.nextPackAt - after.serverNow > 14 * 60000);
    assert.ok(after.nextPackAt - after.serverNow <= 15 * 60000);
  });

  await t.test("évolution atomique : cinq SSR non-Shiny identiques deviennent une SSR Shiny", async () => {
    await db.query("delete from public.user_cards where user_id=$1", [alice]);
    await db.query(`insert into public.user_cards (user_id, card_id, rarity, is_shiny)
      select $1, cards.id, 'SSR', false from public.cards cross join generate_series(1,5)
      where source_id='SSR'`, [alice]);
    const instances = (await db.query("select id from public.user_cards where user_id=$1 order by id", [alice])).rows.map(row=>row.id);
    const evolved = await asUser(alice, () => (db.query("select public.evolve_ssr_card($1::uuid[]) as value", [instances])).then(r => r.rows[0].value));
    assert.equal(evolved.rarity, "SSR");
    assert.equal(evolved.isEvolved, true);
    assert.equal(evolved.shiny, true);
    assert.ok((await asUser(alice, () => rpc("get_achievements"))).find(item => item.id === "transcendance").completedAt);
    const rows = (await db.query("select rarity, is_shiny, is_evolved from public.user_cards where user_id=$1", [alice])).rows;
    assert.deepEqual(rows, [{ rarity: "SSR", is_shiny: true, is_evolved: true }]);
    await db.query("delete from public.user_cards where user_id=$1", [alice]);
    const explicit = (await db.query(`insert into public.user_cards
      (user_id,card_id,date_obtention,rarity,is_shiny,custom_image_url)
      select $1,cards.id,clock_timestamp()+copy.n*interval '1 minute','SSR',false,
        case when copy.n=1 then 'https://i.imgur.com/preserved.png' else null end
      from public.cards cards cross join generate_series(1,6) copy(n)
      where source_id='SSR' returning id,custom_image_url`, [alice])).rows;
    const chosen = explicit.filter(row=>!row.custom_image_url).map(row=>row.id);
    await asUser(alice, () => db.query("select public.evolve_ssr_card($1::uuid[])", [chosen]));
    const preserved = (await db.query("select id,custom_image_url from public.user_cards where user_id=$1 and not is_shiny", [alice])).rows;
    assert.deepEqual(preserved, [explicit.find(row=>row.custom_image_url)]);
    await db.query("delete from public.user_cards where user_id=$1", [alice]);
    await db.query(`insert into public.user_cards (user_id, card_id, rarity)
      select $1, cards.id, 'SSR' from public.cards cross join generate_series(1,4)
      where source_id='SSR'`, [alice]);
    const insufficient = (await db.query("select id from public.user_cards where user_id=$1", [alice])).rows.map(row=>row.id);
    await assert.rejects(asUser(alice, () => db.query("select public.evolve_ssr_card($1::uuid[])", [insufficient])), /FIVE_DISTINCT_SSR_COPIES_REQUIRED/);
    assert.equal(await count(alice), 4);
    await db.query("delete from public.user_cards where user_id=$1", [alice]);
    await db.query(`insert into public.user_cards (user_id, card_id, rarity, is_shiny, is_evolved)
      select $1, cards.id, 'SSR', copy.shiny, copy.shiny
      from public.cards cross join (values (false),(false),(false),(false),(true)) as copy(shiny)
      where source_id='SSR'`, [alice]);
    const withShiny = (await db.query("select id from public.user_cards where user_id=$1", [alice])).rows.map(row=>row.id);
    await assert.rejects(asUser(alice, () => db.query("select public.evolve_ssr_card($1::uuid[])", [withShiny])), /INVALID_SSR_COPIES/);
    assert.equal(await count(alice), 5);
    await db.query("delete from public.user_cards where user_id=$1", [alice]);
  });

  await t.test("dossiers : création, rangement, propriété et suppression sans supprimer la carte", async () => {
    const cardId = (await db.query("select id from public.cards where source_id='C'")).rows[0].id;
    const copyId = (await db.query("insert into public.user_cards (user_id,card_id,rarity) values ($1,$2,'C') returning id", [alice, cardId])).rows[0].id;
    const folder = (await asUser(alice, () => db.query("select public.create_folder('Favoris') as value"))).rows[0].value;
    await asUser(alice, () => db.query("select public.move_card_to_folder($1,$2)", [copyId, folder.id]));
    assert.equal((await db.query("select folder_id from public.user_cards where id=$1", [copyId])).rows[0].folder_id, folder.id);
    await assert.rejects(asUser(bob, () => db.query("select public.move_card_to_folder($1,$2)", [copyId, folder.id])), /FOLDER_NOT_FOUND/);
    await asUser(alice, () => db.query("select public.delete_folder($1)", [folder.id]));
    assert.equal((await db.query("select folder_id from public.user_cards where id=$1", [copyId])).rows[0].folder_id, null);
    await db.query("delete from public.user_cards where id=$1", [copyId]);
  });

  await t.test("wishlist : toute acquisition retire automatiquement la carte", async () => {
    const cardId = (await db.query("select id from public.cards where source_id='R'")).rows[0].id;
    await db.query("insert into public.wishlist (user_id,card_id) values ($1,$2)", [alice,cardId]);
    await db.query("insert into public.user_cards (user_id,card_id,rarity) values ($1,$2,'R')", [alice,cardId]);
    assert.equal(Number((await db.query("select count(*) as count from public.wishlist where user_id=$1 and card_id=$2", [alice,cardId])).rows[0].count),0);
    await db.query("delete from public.user_cards where user_id=$1 and card_id=$2", [alice,cardId]);
  });

  await t.test("image personnalisée : Imgur uniquement, propriété et réinitialisation", async () => {
    const cardId = (await db.query("select id from public.cards where source_id='C'")).rows[0].id;
    const copyId = (await db.query("insert into public.user_cards (user_id,card_id,rarity) values ($1,$2,'C') returning id", [alice,cardId])).rows[0].id;
    const customized = (await asUser(alice, () => db.query("select public.set_card_custom_image($1,$2) as value", [copyId,"https://i.imgur.com/yokkai.png"]))).rows[0].value;
    assert.equal(customized.image, "https://i.imgur.com/yokkai.png");
    assert.equal(customized.catalogueImage, "https://storage.example/card.png");
    await assert.rejects(asUser(alice, () => db.query("select public.set_card_custom_image($1,$2)", [copyId,"https://example.com/nope.png"])), /INVALID_IMGUR_URL/);
    await assert.rejects(asUser(bob, () => db.query("select public.set_card_custom_image($1,$2)", [copyId,"https://imgur.com/abc"])), /CARD_NOT_OWNED/);
    const reset = (await asUser(alice, () => db.query("select public.set_card_custom_image($1,null) as value", [copyId]))).rows[0].value;
    assert.equal(reset.image, "https://storage.example/card.png");
    assert.equal(reset.customImageUrl, null);
    await db.query("delete from public.user_cards where id=$1", [copyId]);
  });

  await t.test("Decision Pack quotidien : cinq SR minimum, choix persistant et une seule carte gardée", async () => {
    const decisionPackDefinition = (await db.query("select pg_get_functiondef('public.open_decision_pack()'::regprocedure) as value")).rows[0].value;
    assert.match(decisionPackDefinition, /rarities\s+public\.card_rarity\[\]\s*:=\s*array\['SR',\s*'SSR',\s*'LR'\]/i);
    assert.doesNotMatch(decisionPackDefinition, /array\['C'|array\['R'/i);
    assert.match(decisionPackDefinition, /rarete_base\s*=\s*'LR'\s+and\s+random\(\)\s*<\s*(?:0)?\.001/i);
    assert.match(decisionPackDefinition, /roll<\.978 then 1 when roll<\.998 then 2 else 3/);
    assert.doesNotMatch(decisionPackDefinition, /rarete_base\s+in\s*\(\s*'SSR'\s*,\s*'LR'/i);
    const initial = await asUser(bob, () => rpc("get_decision_pack_status"));
    assert.equal(initial.available, true);
    assert.deepEqual(initial.pending, []);
    const choices = await asUser(bob, () => rpc("open_decision_pack"));
    assert.equal(choices.length, 5);
    assert.ok(choices.every(card => ["SR", "SSR", "LR"].includes(card.rarity)));
    assert.ok(choices.every(card => card.destructionValue === ({ SR:3, SSR:4, LR:5 })[card.rarity]));
    assert.ok(choices.every(card => !card.shiny || card.rarity === "LR"));
    assert.equal(await count(bob), 0);
    const resumed = await asUser(bob, () => rpc("open_decision_pack"));
    assert.deepEqual(resumed.map(card => card.instanceId), choices.map(card => card.instanceId));
    assert.ok(choices.every(card => card.anime === "Franchise"));
    const balanceBeforeChoice = Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [bob])).rows[0].karas_balance);
    const discardedChoices = choices.filter((_, index) => index !== 1);
    const decisionReward = discardedChoices.reduce((sum, card) => sum + card.destructionValue, 0);
    const liveRarityChoice = discardedChoices[0];
    await db.query("update public.cards set rarete_base='C' where id=$1", [liveRarityChoice.id]);
    const kept = (await asUser(bob, () => db.query("select public.keep_decision_pack_card($1) as value", [choices[1].instanceId]))).rows[0].value;
    assert.equal(await count(bob), 1);
    assert.equal(kept.id, choices[1].id);
    assert.equal(kept.karasReward, decisionReward);
    assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [bob])).rows[0].karas_balance), balanceBeforeChoice + decisionReward);
    await db.query("update public.cards set rarete_base=$2::public.card_rarity where id=$1", [liveRarityChoice.id, liveRarityChoice.rarity]);
    assert.ok((await asUser(bob, () => rpc("get_achievements"))).find(item => item.id === "decision-decisive").completedAt);
    const completed = await asUser(bob, () => rpc("get_decision_pack_status"));
    assert.equal(completed.available, false);
    assert.deepEqual(completed.pending, []);
    await assert.rejects(asUser(bob, () => rpc("open_decision_pack")), /DECISION_PACK_NOT_READY/);
  });

  await t.test("destruction rapide Regular : suppression limitée au propriétaire", async () => {
    const own = (await db.query("select id from public.user_cards where user_id=$1 limit 1", [bob])).rows[0].id;
    await assert.rejects(asUser(alice, () => db.query("select public.discard_regular_pack_card($1)", [own])), /CARD_NOT_OWNED/);
    assert.equal(await count(bob), 1);
    await asUser(bob, () => db.query("select public.discard_regular_pack_card($1)", [own]));
    assert.equal(await count(bob), 0);
  });

  await t.test("destruction : gain de 1 à 5 Karas selon la rareté", async () => {
    await db.query("update public.user_profiles set karas_balance=0 where user_id=$1", [bob]);
    for (const [rarity, reward] of Object.entries({ C: 1, R: 2, SR: 3, SSR: 4, LR: 5 })) {
      const cardId = (await db.query("select id from public.cards where source_id=$1", [rarity])).rows[0].id;
      const copyId = (await db.query("insert into public.user_cards(user_id,card_id,rarity) values ($1,$2,$3::public.card_rarity) returning id", [bob, cardId, rarity])).rows[0].id;
      const estimate = (await asUser(bob, () => db.query("select public.get_pack_destruction_values(array[$1]::uuid[]) as value", [copyId]))).rows[0].value;
      assert.equal(estimate[copyId], reward);
      const before = Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [bob])).rows[0].karas_balance);
      await asUser(bob, () => db.query("select public.discard_regular_pack_card($1)", [copyId]));
      assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [bob])).rows[0].karas_balance), before + reward);
    }
  });

  await t.test("catalogue incomplet : ni copie créée ni timer consommé", async () => {
    await db.query("update public.cards set rarete_base='LR' where source_id='SSR'");
    const beforeCount = await count(bob);
    const beforeTime = await deadline(bob);
    await assert.rejects(asUser(bob, () => rpc("open_regular_pack")), /CATALOGUE_INCOMPLETE/);
    assert.equal(await count(bob), beforeCount);
    assert.equal(await deadline(bob), beforeTime);
    await db.query("update public.cards set rarete_base='SSR' where source_id='SSR'");
  });

  await t.test("échec tardif de mise à jour : rollback des cinq insertions", async () => {
    await db.exec(`create function public.fail_timer_test() returns trigger language plpgsql as
      $$ begin raise exception 'SIMULATED_FAILURE'; end; $$;
      create trigger fail_timer before update on public.user_profiles
      for each row execute function public.fail_timer_test();`);
    const before = await deadline(bob);
    await assert.rejects(asUser(bob, () => rpc("open_regular_pack")), /SIMULATED_FAILURE/);
    assert.equal(await count(bob), 0);
    assert.equal(await deadline(bob), before);
    await db.exec("drop trigger fail_timer on public.user_profiles; drop function public.fail_timer_test()");
  });

  await t.test("enchères : gel, mises, remboursement, anti-snipe, suivi et règlement", async () => {
    const cardId = (await db.query("select id from public.cards where source_id='LR'")).rows[0].id;
    await db.query("update public.cards set favoris_count=321 where id=$1", [cardId]);
    const copyId = (await db.query("insert into public.user_cards (user_id,card_id,rarity,is_first_owner) values ($1,$2,'LR',true) returning id", [alice, cardId])).rows[0].id;
    await db.query("update public.user_profiles set karas_balance=100 where user_id in ($1,$2)", [bob, charlie]);

    await asUser(alice, () => db.query("select public.set_card_custom_image($1,$2)", [copyId,"https://i.imgur.com/auction.png"]));
    const auctionId = (await asUser(alice, () => db.query("select public.create_auction($1,10,15) as id", [copyId]))).rows[0].id;
    assert.equal((await db.query("select custom_image_url from public.user_cards where id=$1", [copyId])).rows[0].custom_image_url, null);
    const listed = (await asUser(bob, () => db.query("select public.list_auctions() as value"))).rows[0].value.find(item => item.id === auctionId);
    assert.equal(listed.card.image, "https://storage.example/card.png");
    assert.equal(listed.card.anime, "Franchise");
    assert.equal(listed.popularity, 321);
    assert.equal("customImageUrl" in listed.card, false);
    const publicDetail = (await asUser(bob, () => db.query("select public.get_auction($1) as value", [auctionId]))).rows[0].value;
    assert.equal(publicDetail.card.image, "https://storage.example/card.png");
    assert.equal("customImageUrl" in publicDetail.card, false);
    await assert.rejects(asUser(alice, () => db.query("select public.discard_regular_pack_card($1)", [copyId])), /CARD_FROZEN/);
    await assert.rejects(asUser(alice, () => db.query("select public.create_auction($1,10,15)", [copyId])), /CARD_FROZEN/);
    await assert.rejects(asUser(alice, () => db.query("select public.place_bid($1,20)", [auctionId])), /SELLER_CANNOT_BID/);

    await asUser(bob, () => db.query("select public.place_bid($1,20)", [auctionId]));
    assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [bob])).rows[0].karas_balance), 80);
    await asUser(charlie, () => db.query("select public.place_bid($1,30)", [auctionId]));
    const bobAuctions = (await asUser(bob, () => db.query("select public.list_auctions() as value"))).rows[0].value;
    const bobParticipation = bobAuctions.find(item => item.id === auctionId);
    assert.equal(bobParticipation.hasBid, true);
    assert.equal(bobParticipation.buyerId, charlie);
    assert.equal((await asUser(alice, () => db.query("select public.list_auctions() as value"))).rows[0].value.find(item => item.id === auctionId).hasBid, false);
    const outbidNotification = (await asUser(bob, () => db.query("select public.list_notifications() as value"))).rows[0].value.find(item => item.type === "outbid");
    assert.deepEqual({referenceId:outbidNotification.referenceId,cardName:outbidNotification.cardName},{referenceId:auctionId,cardName:"LR"});
    assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [bob])).rows[0].karas_balance), 100);
    assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [charlie])).rows[0].karas_balance), 70);
    await assert.rejects(asUser(bob, () => db.query("select public.place_bid($1,39)", [auctionId])), /BID_TOO_LOW/);

    const watched = (await asUser(bob, () => db.query("select public.toggle_auction_watch($1) as value", [auctionId]))).rows[0].value;
    assert.equal(watched, true);
    assert.equal((await asUser(bob, () => db.query("select public.get_auction($1) as value", [auctionId]))).rows[0].value.watched, true);
    assert.equal((await asUser(bob, () => db.query("select public.toggle_auction_watch($1) as value", [auctionId]))).rows[0].value, false);

    await db.query("update public.auctions set ends_at=clock_timestamp()+interval '4 minutes' where id=$1", [auctionId]);
    const beforeExtension = Date.parse((await db.query("select ends_at::text as value from public.auctions where id=$1", [auctionId])).rows[0].value);
    await asUser(charlie, () => db.query("select public.place_bid($1,40)", [auctionId]));
    assert.equal(Number((await db.query("select count(*) as count from public.notifications where user_id=$1 and type='outbid'", [charlie])).rows[0].count),0);
    const afterExtension = Date.parse((await db.query("select ends_at::text as value from public.auctions where id=$1", [auctionId])).rows[0].value);
    assert.equal(afterExtension, beforeExtension + 60_000);
    const detail = (await asUser(charlie, () => db.query("select public.get_auction($1) as value", [auctionId]))).rows[0].value;
    assert.equal(detail.card.anime, "Franchise");
    assert.deepEqual(detail.history.map((bid) => bid.amount), [40, 30, 20]);

    await db.query("update public.auctions set ends_at=clock_timestamp()-interval '1 second' where id=$1", [auctionId]);
    await asUser(charlie, () => db.query("select public.list_auctions()"));
    const sold = (await db.query("select status,current_price,buyer_id from public.auctions where id=$1", [auctionId])).rows[0];
    assert.deepEqual(sold, { status: "sold", current_price: 40, buyer_id: charlie });
    const transferred = (await db.query("select user_id,is_first_owner from public.user_cards where id=$1", [copyId])).rows[0];
    assert.deepEqual(transferred, { user_id: charlie, is_first_owner: false });
    const wonNotification = (await asUser(charlie, () => db.query("select public.list_notifications() as value"))).rows[0].value.find(item => item.type === "auction_won");
    assert.deepEqual({referenceId:wonNotification.referenceId,cardName:wonNotification.cardName},{referenceId:auctionId,cardName:"LR"});
    assert.ok((await asUser(charlie, () => rpc("get_achievements"))).find(item => item.id === "adjuge").completedAt);
    const achievementNotification = (await asUser(charlie, () => db.query("select public.list_notifications() as value"))).rows[0].value.find(item => item.type === "achievement_completed" && item.referenceId === "adjuge");
    assert.equal(achievementNotification.achievementName, "Adjugé !");
    await db.query("select public.complete_achievements($1,array['auctions_won'])", [charlie]);
    assert.equal(Number((await db.query("select count(*) as count from public.notifications where user_id=$1 and type='achievement_completed' and achievement_id='adjuge'", [charlie])).rows[0].count), 1);
    assert.equal(Number((await db.query("select karas_balance from public.user_profiles where user_id=$1", [alice])).rows[0].karas_balance), 110);

    const unsoldCopy = (await db.query("insert into public.user_cards (user_id,card_id,rarity) values ($1,$2,'LR') returning id", [alice, cardId])).rows[0].id;
    await asUser(alice, () => db.query("select public.set_card_custom_image($1,$2)", [unsoldCopy,"https://imgur.com/unsold"]));
    const unsoldId = (await asUser(alice, () => db.query("select public.create_auction($1,10,15) as id", [unsoldCopy]))).rows[0].id;
    await db.query("update public.auctions set ends_at=clock_timestamp()-interval '1 second' where id=$1", [unsoldId]);
    await asUser(alice, () => db.query("select public.list_auctions()"));
    assert.equal((await db.query("select status from public.auctions where id=$1", [unsoldId])).rows[0].status, "expired");
    assert.equal((await db.query("select custom_image_url from public.user_cards where id=$1", [unsoldCopy])).rows[0].custom_image_url, null);
    await asUser(alice, () => db.query("select public.discard_regular_pack_card($1)", [unsoldCopy]));
  });

  await t.test("amis : recherche, demande, droits de réponse, acceptation et refus", async () => {
    const shortSearch = (await asUser(bob, () => db.query("select public.search_users('A') as value"))).rows[0].value;
    assert.deepEqual(shortSearch, []);
    const search = (await asUser(bob, () => db.query("select public.search_users('ali') as value"))).rows[0].value;
    assert.deepEqual(search.map(({pseudo,status})=>({pseudo,status})), [{pseudo:"Alice",status:"none"}]);

    const requestId = (await asUser(bob, () => db.query("select public.send_friend_request($1) as id", [alice]))).rows[0].id;
    const friendNotification = (await asUser(alice, () => db.query("select public.list_notifications() as value"))).rows[0].value.find(item => item.type === "friend_request");
    assert.deepEqual({referenceId:friendNotification.referenceId,actorPseudo:friendNotification.actorPseudo},{referenceId:requestId,actorPseudo:"Bob"});
    await assert.rejects(asUser(alice, () => db.query("select public.send_friend_request($1)", [bob])), /FRIENDSHIP_EXISTS/);
    await assert.rejects(asUser(bob, () => db.query("select public.respond_friend_request($1,true)", [requestId])), /FRIEND_REQUEST_NOT_FOUND/);
    const alicePending = (await asUser(alice, () => db.query("select public.get_friendships() as value"))).rows[0].value;
    assert.equal(alicePending.incoming[0].pseudo, "Bob");
    assert.equal((await asUser(bob, () => db.query("select public.get_public_profile($1) as value", [alice]))).rows[0].value.friendshipStatus, "outgoing");

    assert.equal((await asUser(alice, () => db.query("select public.respond_friend_request($1,true) as value", [requestId]))).rows[0].value, true);
    assert.equal((await asUser(alice, () => db.query("select public.get_friendships() as value"))).rows[0].value.friends[0].pseudo, "Bob");
    assert.equal((await asUser(bob, () => db.query("select public.get_public_profile($1) as value", [alice]))).rows[0].value.friendshipStatus, "accepted");
    const friendCardId = (await db.query("select id from public.cards where source_id='C'")).rows[0].id;
    await db.query("insert into public.user_cards(user_id,card_id,rarity,custom_image_url) values($1,$2,'C','https://i.imgur.com/private.png')",[alice,friendCardId]);
    const friendCollection = (await asUser(bob, () => db.query("select public.get_friend_collection($1) as value",[alice]))).rows[0].value;
    assert.ok(friendCollection.some(card=>card.id===friendCardId));
    assert.ok(friendCollection.every(card=>card.folderId===null));
    assert.ok(friendCollection.some(card=>card.id===friendCardId&&card.image==="https://i.imgur.com/private.png"&&card.customImageUrl==="https://i.imgur.com/private.png"));
    await assert.rejects(asUser(charlie,()=>db.query("select public.get_friend_collection($1)",[alice])),/FRIENDS_ONLY/);

    const declinedId = (await asUser(alice, () => db.query("select public.send_friend_request($1) as id", [charlie]))).rows[0].id;
    assert.equal((await asUser(charlie, () => db.query("select public.respond_friend_request($1,false) as value", [declinedId]))).rows[0].value, false);
    assert.equal(Number((await db.query("select count(*) as count from public.friendships where id=$1", [declinedId])).rows[0].count), 0);
    await assert.rejects(asUser(bob, () => db.query("select * from public.friendships")), /permission denied/);
  });

  await t.test("échanges : amis uniquement, contre-offre et validation atomique à l’acceptation", async () => {
    const cardId = (await db.query("select id from public.cards where source_id='C'")).rows[0].id;
    const aliceCard = (await db.query("insert into public.user_cards(user_id,card_id,rarity,is_first_owner) values($1,$2,'C',true) returning id",[alice,cardId])).rows[0].id;
    const bobCard = (await db.query("insert into public.user_cards(user_id,card_id,rarity,is_first_owner) values($1,$2,'C',true) returning id",[bob,cardId])).rows[0].id;
    await db.query("update public.user_profiles set karas_balance=100 where user_id in ($1,$2)",[alice,bob]);
    await db.query("insert into public.wishlist(user_id,card_id) values($1,$2),($3,$2) on conflict do nothing",[alice,cardId,bob]);
    await assert.rejects(asUser(charlie,()=>db.query("select public.create_trade_offer($1,'{}',10,'{}',0,null)",[bob])),/FRIENDS_ONLY/);

    const offerId=(await asUser(alice,()=>db.query("select public.create_trade_offer($1,$2,10,$3,15,null) as id",[bob,[aliceCard],[bobCard]]))).rows[0].id;
    const tradeNotification=(await asUser(bob,()=>db.query("select public.list_notifications() as value"))).rows[0].value.find(item=>item.type==="trade_offer_received"&&item.referenceId===offerId);
    assert.equal(tradeNotification.actorPseudo,"Alice");
    const inbox=(await asUser(bob,()=>db.query("select public.list_trade_offers() as value"))).rows[0].value;
    assert.equal(inbox[0].offeredCards[0].instanceId,aliceCard);
    assert.equal(inbox[0].offeredCards[0].anime,"Franchise");
    await assert.rejects(asUser(alice,()=>db.query("select public.respond_trade_offer($1,'accept')",[offerId])),/TRADE_NOT_PENDING/);
    assert.equal((await asUser(bob,()=>db.query("select public.respond_trade_offer($1,'accept') as value",[offerId]))).rows[0].value,true);
    assert.equal((await db.query("select user_id,is_first_owner,folder_id from public.user_cards where id=$1",[aliceCard])).rows[0].user_id,bob);
    assert.equal((await db.query("select user_id,is_first_owner,folder_id from public.user_cards where id=$1",[bobCard])).rows[0].user_id,alice);
    assert.deepEqual((await db.query("select user_id,karas_balance from public.user_profiles where user_id in ($1,$2) order by user_id",[alice,bob])).rows,[{user_id:alice,karas_balance:105},{user_id:bob,karas_balance:95}]);
    assert.ok((await asUser(alice, () => rpc("get_achievements"))).find(item => item.id === "marche-conclu").completedAt);
    assert.ok((await asUser(bob, () => rpc("get_achievements"))).find(item => item.id === "marche-conclu").completedAt);
    assert.equal(Number((await db.query("select count(*) as count from public.wishlist where user_id in ($1,$2) and card_id=$3",[alice,bob,cardId])).rows[0].count),0);

    const stale=(await asUser(alice,()=>db.query("select public.create_trade_offer($1,'{}',0,$2,0,null) as id",[bob,[aliceCard]]))).rows[0].id;
    await db.query("update public.user_cards set user_id=$1 where id=$2",[charlie,aliceCard]);
    await assert.rejects(asUser(bob,()=>db.query("select public.respond_trade_offer($1,'accept')",[stale])),/TRADE_CARD_UNAVAILABLE/);
    assert.equal((await db.query("select status from public.trade_offers where id=$1",[stale])).rows[0].status,"pending");

    const parent=(await asUser(alice,()=>db.query("select public.create_trade_offer($1,'{}',10,'{}',0,null) as id",[bob]))).rows[0].id;
    const counter=(await asUser(bob,()=>db.query("select public.create_trade_offer($1,'{}',5,'{}',5,$2) as id",[alice,parent]))).rows[0].id;
    const counterNotification=(await asUser(alice,()=>db.query("select public.list_notifications() as value"))).rows[0].value.find(item=>item.type==="trade_offer_received"&&item.referenceId===counter);
    assert.equal(counterNotification.actorPseudo,"Bob");
    assert.equal((await db.query("select status from public.trade_offers where id=$1",[parent])).rows[0].status,"countered");
    assert.equal((await asUser(alice,()=>db.query("select public.respond_trade_offer($1,'decline') as value",[counter]))).rows[0].value,false);
  });

  await t.test("RLS : Bob ne voit pas Alice et ne peut pas écrire directement", async () => {
    const rows = await asUser(bob, () => db.query("select * from public.user_cards"));
    assert.equal(rows.rows.length, 0);
    const profiles = await asUser(bob, () => db.query("select user_id from public.user_profiles"));
    assert.deepEqual(profiles.rows.map((r) => r.user_id), [bob]);
    await assert.rejects(asUser(bob, () => db.query("update public.user_profiles set next_regular_pack_at=now()")), /permission denied/);
    await assert.rejects(asUser(bob, () => db.query("insert into public.user_cards (user_id,card_id) select $1,id from public.cards limit 1", [bob])), /permission denied/);
    await assert.rejects(asUser(bob, () => db.query("update public.cards set rarete_base='C'")), /permission denied/);
  });

  await t.test("RPC réservées aux comptes et refus d'un profil manquant", async () => {
    for (const name of ["get_game_info", "get_regular_pack_status", "open_regular_pack"]) {
      await assert.rejects(asUser(null, () => rpc(name), "anon"), /permission denied/);
      await assert.rejects(asUser(null, () => rpc(name)), /AUTH_REQUIRED/);
      await assert.rejects(asUser("00000000-0000-0000-0000-000000000099", () => rpc(name)), /PROFILE_MISSING/);
    }
    await assert.rejects(asUser(null, () => db.query("select public.evolve_ssr_card(array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()])"), "anon"), /permission denied/);
  });
});
