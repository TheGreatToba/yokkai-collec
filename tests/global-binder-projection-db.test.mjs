import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayMigrations } from "../scripts/replay-migrations.mjs";
import { exerciseGlobalBinders } from "./helpers/global-binders.mjs";

test("global binders preserve sources, preferences, access rules and reversible presentation", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());
  for (const check of await exerciseGlobalBinders(db)) t.diagnostic(check);
});

test("operator activation and rollback are checksum-gated, idempotent and preserve raw rows", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());
  await db.exec(`insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    select 'operator-fixture-'||md5(source_license),'OPERATOR FIXTURE',category,source_license,'C','https://example.test/a.png','operator-fixture'
    from public.global_binder_aliases`);
  const before = (
    await db.query(
      "select jsonb_agg(to_jsonb(c) order by id) as cards from public.cards c"
    )
  ).rows[0].cards;
  const enable = readFileSync(
    new URL(
      "../supabase/operations/enable-global-binders.sql",
      import.meta.url
    ),
    "utf8"
  );
  const disable = readFileSync(
    new URL(
      "../supabase/operations/disable-global-binders.sql",
      import.meta.url
    ),
    "utf8"
  );
  await db.exec(enable);
  await db.exec(enable);
  assert.equal(
    (await db.query("select enabled from public.global_binder_settings"))
      .rows[0].enabled,
    true
  );
  await db.exec(disable);
  const settings = (
    await db.query(
      "select enabled,preferences_global from public.global_binder_settings"
    )
  ).rows[0];
  assert.deepEqual(settings, { enabled: false, preferences_global: true });
  assert.deepEqual(
    (
      await db.query(
        "select jsonb_agg(to_jsonb(c) order by id) as cards from public.cards c"
      )
    ).rows[0].cards,
    before
  );
  await db.exec(
    "update public.global_binder_settings set manifest_sha256=repeat('0',64)"
  );
  await assert.rejects(db.exec(enable), /GLOBAL_BINDER_UNREVIEWED_MANIFEST/);
  await db.exec("rollback");
});
