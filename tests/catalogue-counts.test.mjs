import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

test("catalogue filter totals are exact across all rows and remain caller-scoped", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());
  await db.exec(`insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    select 'counts-'||i,'Counter '||i,case when i<=1000 then 'ANIME/MANGA' else 'FILM' end,'Counter series',
      case when i%2=0 then 'LR'::public.card_rarity else 'C'::public.card_rarity end,
      'https://example.test/card.png','test' from generate_series(1,1251)i;`);
  const baseline = (
    await db.query("select count(*)::int as total from public.cards")
  ).rows[0].total;
  const result = (
    await db.query("select public.get_catalogue_filter_counts() as value")
  ).rows[0].value;
  assert.equal(result.total, baseline);
  assert.equal(
    Object.values(result.categories).reduce((a, b) => a + b, 0),
    baseline
  );
  assert.equal(
    Object.values(result.rarities).reduce((a, b) => a + b, 0),
    baseline
  );
  for (const row of (
    await db.query(
      "select categorie, count(*)::int as total from public.cards group by categorie"
    )
  ).rows)
    assert.equal(result.categories[row.categorie], row.total);
  const definition = (
    await db.query(
      "select prosecdef,proconfig from pg_proc where oid='public.get_catalogue_filter_counts()'::regprocedure"
    )
  ).rows[0];
  assert.equal(definition.prosecdef, false);
  assert.ok(
    definition.proconfig.some(value => value.startsWith("search_path="))
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.get_catalogue_filter_counts()','execute') as allowed"
      )
    ).rows[0].allowed,
    false
  );
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select public.get_catalogue_filter_counts() as value"))
      .rows[0].value.total,
    baseline
  );
  await db.exec("reset role; delete from public.cards");
  assert.deepEqual(
    (await db.query("select public.get_catalogue_filter_counts() as value"))
      .rows[0].value,
    { total: 0, rarities: {}, categories: {} }
  );
});

test("catalogue totals are cached briefly, and a failed request is retryable", async () => {
  const compile = path =>
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }).outputText;
  let now = 0,
    calls = 0,
    fail = false;
  const state = {
    exports: {},
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    BroadcastChannel: undefined
  };
  vm.runInNewContext(compile("lib/data/player-state.ts"), state);
  const context = {
    exports: {},
    require: name => {
      if (name === "@/lib/data/player-state") return state.exports;
      if (name === "@/utils/supabase/client")
        return {
          createClient: () => ({
            auth: { onAuthStateChange() {} },
            rpc: async name => {
              assert.equal(name, "get_catalogue_filter_counts");
              calls++;
              return {
                data: fail
                  ? null
                  : {
                      total: 1251,
                      rarities: { LR: 625, C: 626 },
                      categories: { FILM: 251, "ANIME/MANGA": 1000 }
                    },
                error: fail ? { code: "42501" } : null
              };
            }
          })
        };
      return {};
    }
  };
  vm.runInNewContext(compile("lib/data/cards.ts"), context);
  assert.equal((await context.exports.getCatalogueFilterCounts()).total, 1251);
  await context.exports.getCatalogueFilterCounts();
  assert.equal(calls, 1);
  now = 30001;
  fail = true;
  await assert.rejects(context.exports.getCatalogueFilterCounts());
  fail = false;
  assert.equal((await context.exports.getCatalogueFilterCounts()).total, 1251);
  assert.equal(calls, 3);
});

test("catalogue exposes its result total and independent global filter counts", () => {
  const source = readFileSync("components/community-views.tsx", "utf8")
    .split("export function SearchView(")[1]
    .split("export function WishlistView")[0];
  assert.match(source, /role="status" className="yk-catalogue-total"/);
  assert.match(source, /counts\.rarities\[item\] \?\? 0/);
  assert.match(source, /counts\.categories\[item\] \?\? 0/);
  assert.match(source, /filterCount\(counts\?\.total\)/);
  assert.match(source, /Filter counts unavailable/);
  assert.match(source, /Card count unavailable/);
});
