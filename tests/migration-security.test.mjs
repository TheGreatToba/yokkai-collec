import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { readFileSync, readdirSync } from "node:fs";
import {
  replayMigrations,
  securityDefinerAccess
} from "../scripts/replay-migrations.mjs";
import allowlist from "./security-definer-allowlist.mjs";
import * as accessPolicy from "./security-definer-allowlist.mjs";

test("billing deletion helper has an explicit owner-only access policy", async t => {
  const signature = "public.prepare_account_deletion_without_billing(uuid)";
  assert.ok(
    accessPolicy.ownerOnly?.includes(signature),
    "Register the billing bypass helper as owner-only"
  );
  const { db } = await replayMigrations();
  t.after(() => db.close());
  for (const helper of accessPolicy.ownerOnly) {
    const { rows } = await db.query(
      `
      select p.proacl is not null as explicit,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role,
        has_function_privilege(p.proowner, p.oid, 'EXECUTE') as owner,
        exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public
      from pg_proc p where p.oid=$1::regprocedure`,
      [helper]
    );
    assert.deepEqual(
      rows,
      [
        {
          explicit: true,
          anon: false,
          authenticated: false,
          service_role: false,
          owner: true,
          public: false
        }
      ],
      helper
    );
  }
  assert.deepEqual(
    (
      await db.query(`select p.oid::regprocedure::text as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proacl is null`)
    ).rows,
    [],
    "Every public function must have explicit ACLs"
  );
});

test("migration versions are unique", () => {
  const names = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter(name => name.endsWith(".sql"))
    .sort();
  const versions = new Map();
  for (const name of names) {
    const version = name.match(/^(\d{14})_/)?.[1];
    assert.ok(version, `Invalid migration filename: ${name}`);
    assert.ok(
      !versions.has(version),
      `Duplicate migration version ${version}: ${versions.get(version)} and ${name}`
    );
    versions.set(version, name);
  }
});

test("all migrations replay with Supabase defaults; SECURITY DEFINER access is explicitly allowed", async t => {
  const start = performance.now();
  const { db, migrations } = await replayMigrations();
  t.after(() => db.close());
  const access = await securityDefinerAccess(db);
  const violations = access.filter(
    ({ signature, role, executable }) =>
      executable && !allowlist[signature]?.includes(role)
  );
  assert.deepEqual(
    violations,
    [],
    "Unexpected SECURITY DEFINER EXECUTE grants"
  );
  for (const [signature, roles] of Object.entries(allowlist)) {
    assert.ok(
      roles.length &&
        roles.every(role => ["anon", "authenticated"].includes(role))
    );
    for (const role of roles) {
      assert.ok(
        access.some(
          row =>
            row.signature === signature && row.role === role && row.executable
        ),
        `Stale allowlist entry: ${signature} / ${role}`
      );
    }
  }
  t.diagnostic(
    `${migrations.length}/${migrations.length} migrations; ${access.length / 2} SECURITY DEFINER functions; ${(performance.now() - start).toFixed(0)} ms`
  );
  await t.test(
    "catalogue detects public SECURITY DEFINER ownership changes",
    async () => {
      const sql = readFileSync(
        new URL("../scripts/schema-catalog.sql", import.meta.url),
        "utf8"
      );
      const credit = async () =>
        (await db.query(sql)).rows
          .map(row => JSON.parse(Object.values(row)[0]))
          .find(
            row =>
              row.kind === "function" &&
              row.name === "public.credit_karas(uuid, integer)"
          );
      const before = await credit();
      assert.equal(
        before.value.owner,
        (await db.query("select current_user as owner")).rows[0].owner
      );
      await db.exec(
        "create role migration_owner; alter function public.credit_karas(uuid, integer) owner to migration_owner"
      );
      const after = await credit();
      assert.equal(after.value.owner, "migration_owner");
      assert.deepEqual(
        { ...before.value, owner: after.value.owner },
        after.value,
        "Owner-only changes must remain visible even when definition and grants match"
      );
    }
  );
});
