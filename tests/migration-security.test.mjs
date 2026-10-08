import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { replayMigrations, securityDefinerAccess } from "../scripts/replay-migrations.mjs";
import allowlist from "./security-definer-allowlist.mjs";

test("all migrations replay with Supabase defaults; SECURITY DEFINER access is explicitly allowed", async (t) => {
  const start = performance.now();
  const { db, migrations } = await replayMigrations();
  t.after(() => db.close());
  const access = await securityDefinerAccess(db);
  const violations = access.filter(({ signature, role, executable }) =>
    executable && !allowlist[signature]?.includes(role));
  assert.deepEqual(violations, [], "Unexpected SECURITY DEFINER EXECUTE grants");
  for (const [signature, roles] of Object.entries(allowlist)) {
    assert.ok(roles.length && roles.every((role) => ["anon", "authenticated"].includes(role)));
    for (const role of roles) {
      assert.ok(access.some((row) => row.signature === signature && row.role === role && row.executable),
        `Stale allowlist entry: ${signature} / ${role}`);
    }
  }
  t.diagnostic(`${migrations.length}/${migrations.length} migrations; ${access.length / 2} SECURITY DEFINER functions; ${(performance.now() - start).toFixed(0)} ms`);
  await t.test("catalogue detects public SECURITY DEFINER ownership changes", async () => {
    const sql = readFileSync(new URL("../scripts/schema-catalog.sql", import.meta.url), "utf8");
    const credit = async () => (await db.query(sql)).rows
      .map((row) => JSON.parse(Object.values(row)[0]))
      .find((row) => row.kind === "function" && row.name === "public.credit_karas(uuid, integer)");
    const before = await credit();
    assert.equal(before.value.owner, (await db.query("select current_user as owner")).rows[0].owner);
    await db.exec("create role migration_owner; alter function public.credit_karas(uuid, integer) owner to migration_owner");
    const after = await credit();
    assert.equal(after.value.owner, "migration_owner");
    assert.deepEqual({ ...before.value, owner: after.value.owner }, after.value,
      "Owner-only changes must remain visible even when definition and grants match");
  });
});
