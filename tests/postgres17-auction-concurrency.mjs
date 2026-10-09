// Required CI job; runs only against a fresh disposable service container, never SSH/prod.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { bootstrapSQL } from "../scripts/replay-migrations.mjs";

const container = process.env.TEST_POSTGRES_CONTAINER;
assert.ok(container, "TEST_POSTGRES_CONTAINER must identify the disposable PostgreSQL 17 service");
const image = execFileSync("docker", ["inspect", "--format", "{{.Config.Image}}", container], { encoding: "utf8" }).trim();
assert.equal(image, "supabase/postgres:17.6.1.136");
const database = "auction_lock_ci";
function session(sql, { user = "auction_ci_admin", db = database } = {}) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-w", "-qAt", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], { stdio: "pipe" });
  let out = "", err = "";
  child.stdout.on("data", b => { out += b; });
  child.stderr.on("data", b => { err += b; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())));
  });
  child.stdin.write(sql + "\n");
  return { child, done, output: () => out };
}
async function query(sql, options) {
  const s = session(sql, options); s.child.stdin.end(); return s.done;
}
async function until(check, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await check()) return; await delay(20); }
  throw new Error(`Timed out: ${description}`);
}

// Init scripts are disabled on this service. Keep the production migration role NOSUPERUSER.
await query("create role postgres login nosuperuser bypassrls createrole; create role anon; create role authenticated; create role service_role bypassrls; create database auction_lock_ci owner postgres;", { db: "postgres" });
const version = await query("select version();");
assert.match(version, /PostgreSQL 17\.6\b/);
console.log(version);
await query(`set role postgres; ${bootstrapSQL}`);
const directory = new URL("../supabase/migrations/", import.meta.url);
const migrations = readdirSync(directory).filter(n => n.endsWith(".sql")).sort();
for (const name of migrations) {
  try { await query(`set role postgres; ${readFileSync(new URL(name, directory), "utf8")}`); }
  catch (error) { throw new Error(`Migration ${name}: ${error.message}`, { cause: error }); }
}
console.log(`${migrations.length}/${migrations.length} migrations replayed as postgres NOSUPERUSER on ${image}`);

const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002", seller = "10000000-0000-4000-8000-000000000003";
const x = "20000000-0000-4000-8000-000000000001", y = "20000000-0000-4000-8000-000000000002";
await query(`
  insert into auth.users(id,raw_user_meta_data) values ('${a}','{"pseudo":"BidA"}'),('${b}','{"pseudo":"BidB"}'),('${seller}','{"pseudo":"BidSeller"}');
  insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    values ('bid-lock-test','Bid','Anime','Bid','SR','https://example.test/card.png','test');
  insert into public.user_cards(user_id,card_id,rarity)
    select '${seller}',id,'SR' from public.cards where source_id='bid-lock-test';
  insert into public.auctions(id,card_instance_id,seller_id,starting_price,current_price,buyer_id,duration_minutes,ends_at)
    select '${x}',id,'${seller}',10,100,'${b}',60,clock_timestamp()+interval '1 hour' from public.user_cards where user_id='${seller}';
  insert into public.auctions(id,seller_id,starting_price,current_price,buyer_id,duration_minutes,ends_at)
    values ('${y}','${seller}',10,100,'${a}',60,clock_timestamp()+interval '1 hour');
  create function public.ci_pause_debit() returns trigger language plpgsql as $$
  begin
    if new.karas_balance < old.karas_balance then perform pg_advisory_xact_lock(721934); end if;
    return new;
  end $$;
  create trigger ci_pause_debit before update of karas_balance on public.user_profiles for each row execute function public.ci_pause_debit();
`);

for (let iteration = 1; iteration <= 50; iteration++) {
  await query(`update public.user_profiles set karas_balance=900 where user_id in ('${a}','${b}'); update public.auctions set buyer_id=case id when '${x}'::uuid then '${b}'::uuid else '${a}'::uuid end,current_price=100,ends_at=clock_timestamp()+interval '1 hour' where id in ('${x}','${y}'); delete from public.bids; delete from public.notifications where type='outbid';`);
  const gate = session("select pg_advisory_lock(721934); select 'READY';");
  await until(() => gate.output().includes("READY"), "coordinator lock");
  const bid = (player, auction, label) => {
    const s = session(`set application_name='${label}'; set statement_timeout='12s'; begin; set local role authenticated; select set_config('request.jwt.claim.sub','${player}',true); select public.place_bid('${auction}',120); commit;`);
    s.child.stdin.end(); return s;
  };
  const first = bid(a, x, "ci-bid-a"), second = bid(b, y, "ci-bid-b");
  // Attach handlers immediately: the expected RED deadlock must not become unhandled.
  const bids = Promise.allSettled([first.done, second.done]);
  try {
    // Before: both debits reach the gate holding opposite profile rows.
    // After: one reaches the gate; the other waits for the ordered profile lock.
    await until(async () => Number(await query("select count(*) from pg_stat_activity where application_name in ('ci-bid-a','ci-bid-b') and wait_event_type='Lock';")) === 2, "two real sessions overlapping on locks");
  } finally {
    gate.child.stdin.end("select pg_advisory_unlock(721934);\n");
    await gate.done;
  }
  const results = await bids;
  const errors = results.filter(r => r.status === "rejected").map(r => r.reason.message);
  assert.deepEqual(errors, [], `Crossed bids iteration ${iteration}: ${errors.join("\n")}`);
  const state = JSON.parse(await query(`select json_build_object(
    'balances',(select json_agg(karas_balance order by user_id) from public.user_profiles where user_id in ('${a}','${b}')),
    'buyers',(select json_agg(buyer_id order by id) from public.auctions where id in ('${x}','${y}')),
    'prices',(select json_agg(current_price order by id) from public.auctions where id in ('${x}','${y}')),
    'bids',(select count(*) from public.bids),
    'notifications',(select count(*) from public.notifications where type='outbid'));`));
  assert.deepEqual(state, { balances: [880, 880], buyers: [a, b], prices: [120, 120], bids: 2, notifications: 2 });
  console.log(`Crossed bids ${iteration}/50: two authenticated sessions committed; balances, escrow, bids and notifications preserved`);
}
