import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

const candidate = "20261021120000_manual_pro_expiry_timing.sql";
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const scope = "test:acct_expiry:price_expiry";
let sequence = 0;

async function player(db) {
  const id = `7a000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)",
    [id, JSON.stringify({ pseudo: `ExpiryFixture${sequence}` })]
  );
  return id;
}

async function manual(db, id, age = "20 minutes 30 seconds") {
  await db.query(
    "select public.billing_set_manual_pro_access($1,true,'Expiry regression')",
    [id]
  );
  await db.query(
    `update public.pro_access_grants set expires_at=clock_timestamp()-$2::interval where user_id=$1`,
    [id, age]
  );
  // Recreate an offline player whose last sync was Pro, with no ready pack at
  // expiry and the next Pro pack due five minutes later. No real clock changes.
  await db.query(
    `update public.user_profiles p set regular_pack_interval_seconds=300,
    decision_pack_interval_seconds=43200,next_regular_pack_at=g.expires_at+interval '5 minutes'
    from public.pro_access_grants g where p.user_id=$1 and g.user_id=p.user_id`,
    [id]
  );
}

async function paid(db, id, age) {
  await db.query(
    `insert into public.billing_accounts(user_id,scope,active,status,period_end,verified_at)
    values($1,$2,true,'active',clock_timestamp()+interval '1 month',clock_timestamp())`,
    [id, scope]
  );
  if (age) {
    await db.query(
      `update public.billing_accounts set period_end=clock_timestamp()-$2::interval where user_id=$1`,
      [id, age]
    );
  }
}

async function status(db, id, kind = "regular") {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    return (await db.query(`select public.get_${kind}_pack_status() value`))
      .rows[0].value;
  } finally {
    await db.exec("reset role");
  }
}

async function deadlineFrom(db, id, relation) {
  return Number(
    (
      await db.query(
        `select extract(epoch from(p.next_regular_pack_at-${relation}.expires_at)) seconds
    from public.user_profiles p join ${relation === "g" ? "public.pro_access_grants g" : "(select user_id,period_end expires_at from public.billing_accounts) a"}
    on ${relation}.user_id=p.user_id where p.user_id=$1`,
        [id]
      )
    ).rows[0].seconds
  );
}

test("manual expiry uses the real last entitlement cutoff, not the next visit", async t => {
  const migrations = readdirSync(migrationDirectory)
    .filter(name => name.endsWith(".sql") && name !== candidate)
    .sort();
  const { db } = await replayMigrations({ migrations });
  t.after(() => db.close());
  const before = await player(db);
  await manual(db, before);
  assert.equal(
    (await status(db, before)).reserve,
    4,
    "Reproduce the audited bug before the migration"
  );
  const metadata = () =>
    db.query(`select oid::text,proname,proowner::text,proacl::text,prosecdef,provolatile,proconfig
    from pg_proc where oid in ('public.billing_sync_pack_timing(uuid,timestamptz)'::regprocedure,
      'public.billing_sync_manual_pro_access()'::regprocedure,
      'public.billing_set_manual_pro_access(uuid,boolean,text,timestamptz,uuid)'::regprocedure,
      'public.billing_set_entitlement_scope(text,boolean)'::regprocedure) order by proname`);
  const oldMetadata = (await metadata()).rows;
  const oldGrants = (
    await db.query("select * from public.pro_access_grants order by user_id")
  ).rows;
  const oldProfiles = (
    await db.query("select * from public.user_profiles order by user_id")
  ).rows;
  await db.exec(readFileSync(new URL(candidate, migrationDirectory), "utf8"));
  assert.deepEqual(
    (await metadata()).rows,
    oldMetadata,
    "Function owners, ACLs, signatures and safety settings are preserved"
  );
  assert.deepEqual(
    (await db.query("select * from public.pro_access_grants order by user_id"))
      .rows,
    oldGrants
  );
  assert.deepEqual(
    (await db.query("select * from public.user_profiles order by user_id"))
      .rows,
    oldProfiles,
    "Installing the migration does not rewrite live balances or timers"
  );
  await db.query("select public.billing_set_entitlement_scope($1,true)", [
    scope
  ]);

  await t.test(
    "manual-only expiry yields two Regular packs after twenty minutes",
    async () => {
      const id = await player(db);
      await manual(db, id);
      const regular = await status(db, id);
      assert.equal(regular.refillSeconds, 600);
      assert.equal(regular.maximum, 5);
      assert.equal(regular.reserve, 2);
      assert.ok(Math.abs((await deadlineFrom(db, id, "g")) - 600) < 0.001);
      const repeated = await status(db, id);
      assert.equal(
        repeated.reserve,
        2,
        "Repeated visits do not rebase progress again"
      );
      const decision = await status(db, id, "decision");
      assert.equal(decision.maximum, 1);
      assert.equal(decision.remaining, 1);
      assert.equal(decision.resetTimeZone, "Europe/Paris");
    }
  );

  for (const lastSource of ["manual", "stripe"]) {
    await t.test(
      `overlapping expired entitlements use the later ${lastSource} cutoff`,
      async () => {
        const id = await player(db);
        await paid(
          db,
          id,
          lastSource === "stripe"
            ? "20 minutes 30 seconds"
            : "40 minutes 30 seconds"
        );
        await manual(
          db,
          id,
          lastSource === "manual"
            ? "20 minutes 30 seconds"
            : "40 minutes 30 seconds"
        );
        await db.query(
          `update public.user_profiles p set regular_pack_interval_seconds=300,
        decision_pack_interval_seconds=43200,next_regular_pack_at=(
          select greatest(g.expires_at,a.period_end)+interval '5 minutes'
          from public.pro_access_grants g join public.billing_accounts a using(user_id) where g.user_id=$1
        ) where p.user_id=$1`,
          [id]
        );
        assert.equal((await status(db, id)).reserve, 2);
        assert.ok(
          Math.abs(
            (await deadlineFrom(db, id, lastSource === "manual" ? "g" : "a")) -
              600
          ) < 0.001
        );
      }
    );
  }

  await t.test(
    "an expired manual grant never prolongs Pro through an ineligible payment mirror",
    async () => {
      for (const patch of [
        "active=false",
        "status='incomplete'",
        "risk_hold=true",
        "scope='test:acct_other:price_other'"
      ]) {
        const id = await player(db);
        await paid(db, id);
        await db.query(
          `update public.billing_accounts set ${patch} where user_id=$1`,
          [id]
        );
        await manual(db, id);
        assert.equal((await status(db, id)).reserve, 2, patch);
      }
    }
  );

  await t.test(
    "deleting an already expired grant retains its actual cutoff",
    async () => {
      const id = await player(db);
      await manual(db, id);
      await db.query("select public.billing_set_manual_pro_access($1,false)", [
        id
      ]);
      assert.equal((await status(db, id)).reserve, 2);
    }
  );

  await t.test(
    "revocation of an unexpired manual grant happens now, without minting credit",
    async () => {
      const id = await player(db);
      await db.query(
        "select public.billing_set_manual_pro_access($1,true,'Active revocation')",
        [id]
      );
      await db.query(
        "update public.user_profiles set next_regular_pack_at=clock_timestamp()+interval '5 minutes' where user_id=$1",
        [id]
      );
      await db.query("select public.billing_set_manual_pro_access($1,false)", [
        id
      ]);
      const regular = await status(db, id);
      assert.equal(regular.reserve, 0);
      assert.equal(regular.maximum, 5);
      assert.ok(regular.nextPackAt - regular.serverNow > 595_000);
      assert.ok(regular.nextPackAt - regular.serverNow <= 600_000);
    }
  );

  await t.test(
    "renewing an expired grant reconciles the intervening Basic time first",
    async () => {
      const id = await player(db);
      await manual(db, id);
      await db.query(
        "select public.billing_set_manual_pro_access($1,true,'Renewed after expiry')",
        [id]
      );
      const regular = await status(db, id);
      assert.equal(regular.maximum, 10);
      assert.equal(regular.refillSeconds, 300);
      assert.equal(regular.reserve, 2);
    }
  );

  await t.test(
    "Basic to Pro to Basic preserves credit and clamps a full ten-pack reserve to five",
    async () => {
      const id = await player(db);
      await db.query(
        "update public.user_profiles set next_regular_pack_at=clock_timestamp()-interval '40 minutes 30 seconds' where user_id=$1",
        [id]
      );
      assert.equal((await status(db, id)).reserve, 5);
      await db.query(
        "select public.billing_set_manual_pro_access($1,true,'Tier transition')",
        [id]
      );
      assert.equal((await status(db, id)).reserve, 5);
      assert.equal((await status(db, id)).maximum, 10);
      await db.query(
        "update public.user_profiles set next_regular_pack_at=clock_timestamp()-interval '45 minutes 30 seconds' where user_id=$1",
        [id]
      );
      assert.equal((await status(db, id)).reserve, 10);
      await db.query("select public.billing_set_manual_pro_access($1,false)", [
        id
      ]);
      assert.equal((await status(db, id)).reserve, 5);
      assert.equal((await status(db, id)).maximum, 5);
    }
  );

  await t.test(
    "a valid remaining entitlement keeps Pro on either side",
    async () => {
      const stripe = await player(db);
      await paid(db, stripe);
      await manual(db, stripe);
      assert.equal((await status(db, stripe)).maximum, 10);
      assert.equal((await status(db, stripe)).refillSeconds, 300);
      const grant = await player(db);
      await paid(db, grant, "20 minutes 30 seconds");
      await db.query(
        "select public.billing_set_manual_pro_access($1,true,'Manual still active')",
        [grant]
      );
      assert.equal((await status(db, grant)).maximum, 10);
      assert.equal((await status(db, grant)).refillSeconds, 300);
    }
  );

  await t.test(
    "disabling the payment scope cuts off now rather than at an older manual expiry",
    async () => {
      const id = await player(db);
      await paid(db, id);
      await manual(db, id);
      await db.query(
        "update public.user_profiles set next_regular_pack_at=clock_timestamp()+interval '5 minutes' where user_id=$1",
        [id]
      );
      await db.query("select public.billing_set_entitlement_scope($1,false)", [
        scope
      ]);
      const regular = await status(db, id);
      assert.equal(regular.reserve, 0);
      assert.equal(regular.refillSeconds, 600);
      assert.ok(regular.nextPackAt - regular.serverNow > 595_000);
      await db.query("select public.billing_set_entitlement_scope($1,true)", [
        scope
      ]);
    }
  );

  await t.test(
    "an immediate Stripe risk revocation is not backdated to an expired manual grant",
    async () => {
      const id = await player(db);
      await paid(db, id);
      await manual(db, id);
      await db.query(
        "update public.user_profiles set next_regular_pack_at=clock_timestamp()+interval '5 minutes' where user_id=$1",
        [id]
      );
      await db.query(
        "update public.billing_accounts set risk_hold=true where user_id=$1",
        [id]
      );
      const regular = await status(db, id);
      assert.equal(regular.reserve, 0);
      assert.equal(regular.refillSeconds, 600);
      assert.ok(regular.nextPackAt - regular.serverNow > 595_000);
    }
  );

  await t.test(
    "a full Pro reserve becomes Basic five while bonuses and daily Decision history survive",
    async () => {
      const id = await player(db);
      await manual(db, id);
      await db.query(
        `update public.user_profiles set next_regular_pack_at=clock_timestamp()-interval '2 hours',
      bonus_regular_packs=7,next_decision_pack_at='2090-01-01T00:00:00Z' where user_id=$1`,
        [id]
      );
      await db.query(
        `insert into public.decision_packs(user_id,status,created_at) values($1,'claimed',clock_timestamp())`,
        [id]
      );
      const regular = await status(db, id);
      assert.equal(regular.reserve, 5);
      assert.equal(regular.maximum, 5);
      assert.equal(regular.bonus, 7);
      assert.equal(regular.available, 12);
      const decision = await status(db, id, "decision");
      assert.equal(decision.remaining, 0);
      assert.equal(decision.maximum, 1);
      assert.equal(
        (
          await db.query(
            "select next_decision_pack_at::text deadline from public.user_profiles where user_id=$1",
            [id]
          )
        ).rows[0].deadline.slice(0, 10),
        "2090-01-01"
      );
    }
  );

  await t.test(
    "SQL entry points and timing columns remain server-only",
    async () => {
      const signatures = [
        "public.billing_sync_pack_timing(uuid,timestamptz)",
        "public.billing_set_entitlement_scope(text,boolean)"
      ];
      for (const signature of signatures) {
        for (const role of ["anon", "authenticated", "service_role"]) {
          assert.equal(
            (
              await db.query(
                "select has_function_privilege($1,$2,'EXECUTE') allowed",
                [role, signature]
              )
            ).rows[0].allowed,
            role === "service_role"
          );
        }
        const config = (
          await db.query(
            "select prosecdef,proconfig from pg_proc where oid=$1::regprocedure",
            [signature]
          )
        ).rows[0];
        assert.ok(config.proconfig.includes('search_path=""'));
      }
      await db.exec("set role authenticated");
      await assert.rejects(
        db.query("select * from public.pro_access_grants"),
        /permission denied/
      );
      await assert.rejects(
        db.query(
          "update public.user_profiles set regular_pack_interval_seconds=300"
        ),
        /permission denied/
      );
      await db.exec("reset role");
    }
  );
});
