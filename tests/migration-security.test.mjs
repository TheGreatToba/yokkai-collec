import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
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
});
