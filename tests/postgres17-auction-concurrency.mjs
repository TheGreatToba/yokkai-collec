// Required CI job; runs only against a fresh disposable service container, never SSH/prod.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { bootstrapSQL } from "../scripts/replay-migrations.mjs";

const container = process.env.TEST_POSTGRES_CONTAINER;
assert.ok(
  container,
  "TEST_POSTGRES_CONTAINER must identify the disposable PostgreSQL 17 service"
);
const image = execFileSync(
  "docker",
  ["inspect", "--format", "{{.Config.Image}}", container],
  { encoding: "utf8" }
).trim();
assert.equal(image, "supabase/postgres:17.6.1.136");
const database = "auction_lock_ci";
function session(sql, { user = "supabase_admin", db = database } = {}) {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-w",
      "-qAt",
      "-U",
      user,
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose"
    ],
    { stdio: "pipe" }
  );
  let out = "",
    err = "";
  child.stdout.on("data", b => {
    out += b;
  });
  child.stderr.on("data", b => {
    err += b;
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code =>
      code === 0 ? resolve(out.trim()) : reject(new Error(err.trim()))
    );
  });
  child.stdin.write(sql + "\n");
  return { child, done, output: () => out };
}
async function query(sql, options) {
  const s = session(sql, options);
  s.child.stdin.end();
  return s.done;
}
async function until(check, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(20);
  }
  throw new Error(`Timed out: ${description}`);
}

// Init scripts are disabled on this service. Keep the production migration role NOSUPERUSER.
await query(
  "create role postgres login nosuperuser bypassrls createrole; create role anon; create role authenticated; create role service_role bypassrls; create database auction_lock_ci owner postgres;",
  { db: "postgres" }
);
const version = await query("select version();");
assert.match(version, /PostgreSQL 17\.6\b/);
console.log(version);
assert.deepEqual(
  JSON.parse(
    await query(
      "select json_build_object('superuser',rolsuper,'bypassrls',rolbypassrls) from pg_roles where rolname='postgres';"
    )
  ),
  { superuser: false, bypassrls: true }
);
await query(`set role postgres; ${bootstrapSQL}`);
const directory = new URL("../supabase/migrations/", import.meta.url);
const migrations = readdirSync(directory)
  .filter(n => n.endsWith(".sql"))
  .sort();
for (const name of migrations) {
  try {
    await query(
      `set role postgres; ${readFileSync(new URL(name, directory), "utf8")}`
    );
  } catch (error) {
    throw new Error(`Migration ${name}: ${error.message}`, { cause: error });
  }
}
console.log(
  `${migrations.length}/${migrations.length} migrations replayed as postgres NOSUPERUSER on ${image}`
);

const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  seller = "10000000-0000-4000-8000-000000000003";
const x = "20000000-0000-4000-8000-000000000001",
  y = "20000000-0000-4000-8000-000000000002";
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
    if new.karas_balance < old.karas_balance then perform pg_advisory_xact_lock_shared(721934); end if;
    return new;
  end $$;
  create trigger ci_pause_debit before update of karas_balance on public.user_profiles for each row execute function public.ci_pause_debit();
`);

for (let iteration = 1; iteration <= 50; iteration++) {
  await query(
    `update public.user_profiles set karas_balance=900 where user_id in ('${a}','${b}'); update public.auctions set buyer_id=case id when '${x}'::uuid then '${b}'::uuid else '${a}'::uuid end,current_price=100,ends_at=clock_timestamp()+interval '1 hour' where id in ('${x}','${y}'); delete from public.bids; delete from public.notifications where type='outbid';`
  );
  const gate = session("select pg_advisory_lock(721934); select 'READY';");
  await until(() => gate.output().includes("READY"), "coordinator lock");
  const bid = (player, auction, label) => {
    const s = session(
      `set application_name='${label}'; set statement_timeout='12s'; begin; set local role authenticated; select set_config('request.jwt.claim.sub','${player}',true); select current_user; select public.place_bid('${auction}',120); commit;`
    );
    s.child.stdin.end();
    return s;
  };
  const [first, second] =
    iteration % 2
      ? [bid(a, x, "ci-bid-a"), bid(b, y, "ci-bid-b")]
      : [bid(b, y, "ci-bid-b"), bid(a, x, "ci-bid-a")];
  // Attach handlers immediately: the expected RED deadlock must not become unhandled.
  const bids = Promise.allSettled([first.done, second.done]);
  try {
    // Before: both debits reach the gate holding opposite profile rows.
    // After: one reaches the gate; the other waits for the ordered profile lock.
    await until(
      async () =>
        Number(
          await query(
            "select count(*) from pg_stat_activity where application_name in ('ci-bid-a','ci-bid-b') and wait_event_type='Lock';"
          )
        ) === 2,
      "two real sessions overlapping on locks"
    );
  } finally {
    gate.child.stdin.end("select pg_advisory_unlock(721934);\n");
    await gate.done;
  }
  const results = await bids;
  const errors = results
    .filter(r => r.status === "rejected")
    .map(r => r.reason.message);
  assert.deepEqual(
    errors,
    [],
    `Crossed bids iteration ${iteration}: ${errors.join("\n")}`
  );
  assert.ok(
    results.every(r => r.value.includes("\nauthenticated\n")),
    "Both callers use the real player role"
  );
  const state = JSON.parse(
    await query(`select json_build_object(
    'balances',(select json_agg(karas_balance order by user_id) from public.user_profiles where user_id in ('${a}','${b}')),
    'buyers',(select json_agg(buyer_id order by id) from public.auctions where id in ('${x}','${y}')),
    'prices',(select json_agg(current_price order by id) from public.auctions where id in ('${x}','${y}')),
    'bids',(select count(*) from public.bids),
    'notifications',(select count(*) from public.notifications where type='outbid'));`)
  );
  assert.deepEqual(state, {
    balances: [880, 880],
    buyers: [a, b],
    prices: [120, 120],
    bids: 2,
    notifications: 2
  });
  console.log(
    `Crossed bids ${iteration}/50: two authenticated sessions committed; balances, escrow, bids and notifications preserved`
  );
}

const asPlayer = (player, sql) =>
  query(
    `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${player}',true); ${sql}; commit;`
  );
await asPlayer(a, `select public.place_bid('${x}',150)`);
assert.equal(
  await query(
    `select karas_balance from public.user_profiles where user_id='${a}';`
  ),
  "850",
  "Self-raise charges only the difference"
);
await assert.rejects(
  asPlayer(seller, `select public.place_bid('${x}',160)`),
  /SELLER_CANNOT_BID/
);
await assert.rejects(
  asPlayer(b, `select public.place_bid('${x}',159)`),
  /BID_TOO_LOW/
);
await assert.rejects(
  asPlayer(b, `select public.place_bid('${x}',1000000)`),
  /INSUFFICIENT_KARAS/
);
await query(
  `update public.auctions set ends_at=clock_timestamp()+interval '4 minutes' where id='${x}';`
);
const before = await query(
  `select ends_at::text from public.auctions where id='${x}';`
);
await asPlayer(a, `select public.place_bid('${x}',160)`);
assert.equal(
  Number(
    await query(
      `select extract(epoch from (ends_at-'${before}'::timestamptz)) from public.auctions where id='${x}';`
    )
  ),
  60
);
assert.equal(
  await query(
    "select has_function_privilege('anon','public.place_bid(uuid,integer)','EXECUTE');"
  ),
  "f"
);
console.log(
  "Auction rules preserved: self-raise delta, seller refusal, minimum bid, insufficient funds, 60s extension and anon denied"
);

// Settlement skips the locked row; the bid must recheck the deadline after waiting.
await query(
  `update public.auctions set ends_at=clock_timestamp()-interval '1 second' where id='${x}';`
);
const expiryState = () =>
  query(`select json_build_object(
  'auction',(select row_to_json(sale) from public.auctions sale where id='${x}'),
  'balances',(select json_agg(karas_balance order by user_id) from public.user_profiles),
  'bids',(select count(*) from public.bids),
  'notifications',(select count(*) from public.notifications));`);
const expiredBefore = await expiryState();
const expiryGate = session(
  `begin; select id from public.auctions where id='${x}' for update; select 'READY';`
);
await until(
  () => expiryGate.output().includes("READY"),
  "expired auction row locked"
);
const lateBid = session(
  `set application_name='ci-expired-bid'; set statement_timeout='12s'; begin; set local role authenticated; select set_config('request.jwt.claim.sub','${b}',true); select public.place_bid('${x}',170); commit;`
);
lateBid.child.stdin.end();
const lateResult = Promise.allSettled([lateBid.done]);
try {
  await until(
    async () =>
      (await query(
        "select count(*) from pg_stat_activity where application_name='ci-expired-bid' and wait_event_type='Lock';"
      )) === "1",
    "late bidder waits after SKIP LOCKED settlement"
  );
} finally {
  expiryGate.child.stdin.end("commit;\n");
  await expiryGate.done;
}
const [lateOutcome] = await lateResult;
assert.equal(
  lateOutcome.status,
  "rejected",
  "An expired auction skipped by settlement must refuse the waiting bid"
);
assert.match(lateOutcome.reason.message, /AUCTION_CLOSED/);
assert.equal(
  await expiryState(),
  expiredBefore,
  "Refused late bid preserves auction, balances, bids and notifications"
);
console.log(
  "Expired auction: real authenticated bidder refused after SKIP LOCKED and row-lock wait; all state preserved"
);

// A committed tombstone must fence both old JWTs and counterpart writes.
const deleting = "30000000-0000-4000-8000-000000000001";
await query(
  `insert into auth.users(id,raw_user_meta_data) values ('${deleting}','{"pseudo":"DeletingPlayer"}');`
);
const deletingCard = await query(
  `insert into public.user_cards(user_id,card_id,rarity) select '${deleting}',id,'SR' from public.cards limit 1 returning id; insert into public.admin_users(user_id) values ('${seller}');`
);
const playerWrite = session(
  `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${deleting}',true); select public.update_profile('DeletingPlayer',null,null); select 'READY';`
);
await until(
  () => playerWrite.output().includes("READY"),
  "in-flight player write holds shared fence"
);
const fence = session(
  `set application_name='ci-deletion-fence'; begin; set local role service_role; select public.begin_account_deletion('${deleting}'); select 'READY';`
);
await until(
  async () =>
    (await query(
      "select count(*) from pg_stat_activity where application_name='ci-deletion-fence' and wait_event_type='Lock';"
    )) === "1",
  "deletion waits for player transaction"
);
playerWrite.child.stdin.end("commit;\n");
await playerWrite.done;
await until(
  () => fence.output().includes("READY"),
  "deletion marker inserted after player commit"
);
const staleWrite = session(
  `set application_name='ci-deleted-jwt'; set role authenticated; select set_config('request.jwt.claim.sub','${deleting}',false); select public.send_friend_request('${seller}');`
);
staleWrite.child.stdin.end();
const outcome = Promise.allSettled([staleWrite.done]);
await until(
  async () =>
    (await query(
      "select count(*) from pg_stat_activity where application_name='ci-deleted-jwt' and wait_event_type='Lock';"
    )) === "1",
  "old JWT waits for marker commit"
);
fence.child.stdin.end("commit;\n");
await fence.done;
const [blocked] = await outcome;
assert.equal(blocked.status, "rejected");
assert.match(blocked.reason.message, /ACCOUNT_DELETED/);
await assert.rejects(
  query(
    `set role authenticated; select set_config('request.jwt.claim.sub','${seller}',false); select public.send_friend_request('${deleting}');`
  ),
  /ACCOUNT_DELETED/
);
assert.equal(
  await query(
    `select count(*) from public.friendships where user_id='${deleting}' or friend_id='${deleting}';`
  ),
  "0"
);
const cleanupLock = session(
  `begin; select pg_advisory_xact_lock(hashtextextended('account-deletion:${deleting}',0)); select 'READY';`
);
await until(
  () => cleanupLock.output().includes("READY"),
  "cleanup holds exclusive fence"
);
try {
  await assert.rejects(
    query(
      `set statement_timeout='2s'; set role authenticated; select set_config('request.jwt.claim.sub','${seller}',false); select public.admin_remove_player_card('${deletingCard}');`
    ),
    /ACCOUNT_DELETED/
  );
} finally {
  cleanupLock.child.stdin.end("rollback;\n");
  await cleanupLock.done;
}
console.log(
  "Account deletion: in-flight write completes before fence; old JWT and counterpart writes blocked; no row-lock/advisory-lock cycle during cleanup"
);

// Chat: real overlapping PostgreSQL sessions, with the second waiting for the author lock.
const chatAuction = "40000000-0000-4000-8000-000000000001";
await query(`insert into public.auctions(id,seller_id,starting_price,current_price,duration_minutes,ends_at)
  values ('${chatAuction}','${seller}',10,10,60,clock_timestamp()+interval '1 hour');`);
async function chatOverlap(waitMs) {
  await query(
    `delete from public.auction_chat_messages where user_id='${seller}';`
  );
  const first = session(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${seller}',true);
    select public.send_auction_chat_message('${chatAuction}','first'); select 'READY';`);
  await until(
    () => first.output().includes("READY"),
    "first chat send holds its transaction lock"
  );
  const second =
    session(`set application_name='ci-chat-waiter'; set statement_timeout='12s'; begin;
    select 'STARTED:'||extract(epoch from transaction_timestamp());
    set local role authenticated; select set_config('request.jwt.claim.sub','${seller}',true);
    select public.send_auction_chat_message('${chatAuction}','second'); commit;`);
  second.child.stdin.end();
  const outcome = Promise.allSettled([second.done]);
  let releaseAt;
  try {
    await until(
      async () =>
        (await query(
          "select count(*) from pg_stat_activity where application_name='ci-chat-waiter' and wait_event_type='Lock' and wait_event='advisory';"
        )) === "1",
      "second real chat send waits on advisory lock"
    );
    await delay(waitMs);
    releaseAt = await query("select extract(epoch from clock_timestamp());");
  } finally {
    first.child.stdin.end("commit;\n");
    await first.done;
  }
  const [result] = await outcome;
  const started = Number(second.output().match(/STARTED:([\d.]+)/)[1]);
  return { result, started, releaseAt: Number(releaseAt) };
}
const immediate = await chatOverlap(0);
assert.equal(immediate.result.status, "rejected");
assert.match(immediate.result.reason.message, /CHAT_RATE_LIMITED/);
assert.equal(
  await query(
    `select count(*) from public.auction_chat_messages where user_id='${seller}';`
  ),
  "1"
);
const waited = await chatOverlap(3200);
assert.equal(waited.result.status, "fulfilled");
const insertedAt = Number(
  await query(
    `select extract(epoch from created_at) from public.auction_chat_messages where user_id='${seller}' and message='second';`
  )
);
assert.ok(
  insertedAt >= waited.releaseAt,
  "created_at uses clock_timestamp after lock release"
);
assert.ok(
  insertedAt - waited.started >= 3,
  "transaction start timestamp must not date the waiting message"
);
assert.equal(
  await query(
    `select count(*) from public.auction_chat_messages where user_id='${seller}';`
  ),
  "2"
);
// Counterproof: the same overlap with now() for inserted.created_at must expose stale dating.
const chatDefinition = await query(
  "select pg_get_functiondef('public.send_auction_chat_message(uuid,text,text)'::regprocedure);"
);
assert.ok(chatDefinition.includes("clean_gif,sent_at)"));
await query(chatDefinition.replace("clean_gif,sent_at)", "clean_gif,now())"));
try {
  const stale = await chatOverlap(3200);
  assert.equal(stale.result.status, "fulfilled");
  const staleAt = Number(
    await query(
      `select extract(epoch from created_at) from public.auction_chat_messages where user_id='${seller}' and message='second';`
    )
  );
  assert.ok(
    staleAt < stale.releaseAt,
    "counterproof catches transaction-start dating"
  );
} finally {
  await query(chatDefinition);
}
console.log(
  "Chat: overlapping sends serialize; immediate second refused; waiting second dated after lock release; now() counterproof fails the timing invariant"
);

// Different authors compete for the same read notification: only the first may re-notify.
await query(`insert into public.bids(auction_id,bidder_id,amount) values ('${chatAuction}','${a}',20),('${chatAuction}','${b}',30);
  insert into public.notifications(user_id,type,reference_id,actor_user_id,read_at,created_at)
    values ('${seller}','auction_chat_mention','${chatAuction}','${b}',clock_timestamp(),clock_timestamp()-interval '601 seconds');`);
const mentionFirst =
  session(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${a}',true);
  select public.send_auction_chat_message('${chatAuction}','@BidSeller'); reset role;
  select 'NOTIFIED:'||extract(epoch from created_at) from public.notifications where user_id='${seller}' and reference_id='${chatAuction}' and type='auction_chat_mention'; select 'READY';`);
await until(
  () => mentionFirst.output().includes("READY"),
  "first author re-notifies and holds notification row"
);
const mentionSecond =
  session(`set application_name='ci-chat-mention-waiter'; set statement_timeout='12s'; begin; set local role authenticated;
  select set_config('request.jwt.claim.sub','${b}',true); select public.send_auction_chat_message('${chatAuction}','@BidSeller'); commit;`);
mentionSecond.child.stdin.end();
const mentionOutcome = Promise.allSettled([mentionSecond.done]);
try {
  await until(
    async () =>
      (await query(
        "select count(*) from pg_stat_activity where application_name='ci-chat-mention-waiter' and wait_event_type='Lock';"
      )) === "1",
    "second author waits on notification uniqueness"
  );
} finally {
  mentionFirst.child.stdin.end("commit;\n");
  await mentionFirst.done;
}
assert.equal((await mentionOutcome)[0].status, "fulfilled");
assert.equal(
  await query(`select count(*) from public.notifications n where n.user_id='${seller}' and n.reference_id='${chatAuction}'
  and n.type='auction_chat_mention' and n.read_at is null and n.actor_user_id='${a}'
  and extract(epoch from n.created_at)=${Number(mentionFirst.output().match(/NOTIFIED:([\d.]+)/)[1])};`),
  "1"
);
console.log(
  "Mentions: concurrent different authors leave exactly one unread notification with the first actor and timestamp untouched"
);

// Export: simultaneous requests serialize, and a commit between two table scans
// never produces a mixed version. Test hooks live only in this disposable DB.
await query(`set role postgres; create table auth.identities(user_id uuid,provider text,created_at timestamptz,updated_at timestamptz); reset role;
  update public.user_profiles set bio='snapshot-before' where user_id='${seller}';
  delete from public.folders where user_id='${seller}';
  insert into public.folders(user_id,nom) values ('${seller}','snapshot-before');`);
const exportRequest = "90000000-0000-4000-8000-000000000001";
const exportNext = "90000000-0000-4000-8000-000000000002";
const reservation = session(`begin; set local role service_role;
  select public.reserve_data_export('${seller}','${exportRequest}'); select 'RESERVED';`);
await until(
  () => reservation.output().includes("RESERVED"),
  "first export reservation"
);
const concurrentExport =
  session(`set statement_timeout='10s'; set role service_role;
  select public.reserve_data_export('${seller}','${exportNext}');`);
concurrentExport.child.stdin.end();
const concurrentResult = Promise.allSettled([concurrentExport.done]);
reservation.child.stdin.end("commit;\n");
await reservation.done;
assert.match(String((await concurrentResult)[0].reason), /EXPORT_IN_PROGRESS/);
const exportDefinition = await query(
  "select pg_get_functiondef('public.build_data_export(uuid,uuid)'::regprocedure);"
);
assert.ok(exportDefinition.includes("'bio',t.bio"));
await query(
  `create function public.export_test_pause() returns text language plpgsql volatile as $$begin perform pg_sleep(2); return ''; end;$$;`
);
async function snapshotOverlap(definition) {
  await query(`update public.user_profiles set bio='snapshot-before' where user_id='${seller}';
    update public.folders set nom='snapshot-before' where user_id='${seller}';`);
  await query(
    definition.replace("'bio',t.bio", "'bio',t.bio||public.export_test_pause()")
  );
  const reader =
    session(`set application_name='ci-export-snapshot-reader'; set role service_role;
    select public.build_data_export('${seller}','${exportRequest}');`);
  reader.child.stdin.end();
  const outcome = Promise.allSettled([reader.done]);
  await until(
    async () =>
      (await query(
        "select count(*) from pg_stat_activity where application_name='ci-export-snapshot-reader' and wait_event='PgSleep';"
      )) === "1",
    "export paused between projections"
  ).catch(async error => {
    const result = (await outcome)[0];
    throw result.status === "rejected" ? result.reason : error;
  });
  await query(`begin; update public.user_profiles set bio='snapshot-after' where user_id='${seller}';
    update public.folders set nom='snapshot-after' where user_id='${seller}'; commit;`);
  const result = (await outcome)[0];
  assert.equal(result.status, "fulfilled");
  const data = JSON.parse(result.value);
  return { profile: data.profile.bio, folder: data.folders[0].nom };
}
try {
  assert.deepEqual(await snapshotOverlap(exportDefinition), {
    profile: "snapshot-before",
    folder: "snapshot-before"
  });
  // Counterproof: re-reading a section in a second VOLATILE statement breaks it.
  const splitRead = exportDefinition.replace(/\bSTABLE\b/i, "VOLATILE").replace(
    "return result;",
    `
    result:=jsonb_set(result,'{folders}',(select jsonb_agg(jsonb_build_object('nom',nom)) from public.folders where user_id=p_user_id));
    return result;`
  );
  assert.deepEqual(await snapshotOverlap(splitRead), {
    profile: "snapshot-before",
    folder: "snapshot-after"
  });
} finally {
  await query(exportDefinition);
  await query(
    `select public.finish_data_export('${seller}','${exportRequest}',false); drop function public.export_test_pause();`
  );
}
console.log(
  "Export: concurrent reservations refuse the second caller; one statement preserves the snapshot; split-read counterproof mixes versions"
);

// UR evolution: a retry with the same five copies must wait, then fail without
// minting a second UR. Reverse input order also exercises deterministic row locks.
const urOwner = "86000000-0000-4000-8000-000000000099";
await query(`insert into auth.users(id,raw_user_meta_data) values ('${urOwner}','{"pseudo":"UrConcurrency"}');
  insert into public.cards(id,source_id,nom,categorie,franchise,rarete_base,image_url,source)
    values (md5('ur-concurrency')::uuid,'ur-concurrency','UR concurrency','ANIME/MANGA','UR concurrency','SSR','https://example.test/ur.png','test');
  insert into public.user_cards(user_id,card_id,rarity)
    select '${urOwner}',md5('ur-concurrency')::uuid,'SSR' from generate_series(1,5);`);
const urIds = JSON.parse(
  await query(
    `select json_agg(id order by id) from public.user_cards where user_id='${urOwner}';`
  )
);
const urArray = ids => `array[${ids.map(id => `'${id}'`).join(",")}]::uuid[]`;
const firstEvolution =
  session(`begin; set local statement_timeout='15s'; set local role authenticated;
  set local request.jwt.claim.sub='${urOwner}';
  select public.evolve_ssr_card(${urArray(urIds)}); select 'UR_LOCKED';`);
await until(
  () => firstEvolution.output().includes("UR_LOCKED"),
  "first UR evolution holds its copy locks"
);
const duplicateEvolution =
  session(`set statement_timeout='15s'; set application_name='ci-ur-duplicate';
  set role authenticated; set request.jwt.claim.sub='${urOwner}';
  select public.evolve_ssr_card(${urArray([...urIds].reverse())});`);
duplicateEvolution.child.stdin.end();
const duplicateOutcome = Promise.allSettled([duplicateEvolution.done]);
await until(
  async () =>
    (await query(
      "select count(*) from pg_stat_activity where application_name='ci-ur-duplicate' and wait_event_type='Lock';"
    )) === "1",
  "duplicate evolution waits for the first transaction"
);
firstEvolution.child.stdin.end("commit;\n");
await firstEvolution.done;
const duplicate = (await duplicateOutcome)[0];
assert.equal(duplicate.status, "rejected");
assert.match(String(duplicate.reason), /SSR_CARD_NOT_OWNED/);
assert.deepEqual(
  JSON.parse(
    await query(
      `select json_build_object('copies',count(*),'ur',count(*) filter(where rarity='UR' and is_evolved and not is_shiny)) from public.user_cards where user_id='${urOwner}';`
    )
  ),
  { copies: 1, ur: 1 }
);
console.log(
  "UR: concurrent duplicate evolution waits, consumes five SSR once and creates exactly one non-shiny UR"
);
