import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

function setup() {
  let now = 0,
    fail = false;
  const calls = [];
  const compile = path =>
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }).outputText;
  const state = {
    exports: {},
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    BroadcastChannel: undefined
  };
  vm.runInNewContext(compile("../lib/data/player-state.ts"), state);
  const client = {
    auth: { onAuthStateChange() {} },
    from() {
      let options, from, to;
      const filters = [],
        orders = [];
      const q = {
        select(_fields, o) {
          options = o;
          return q;
        },
        or(x) {
          filters.push(x);
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        order(k) {
          orders.push(k);
          return q;
        },
        range(a, b) {
          from = a;
          to = b;
          return q;
        },
        then(resolve) {
          calls.push({ count: options?.count, filters, orders, from, to });
          return Promise.resolve({
            data: [
              {
                id: String(from),
                nom: "Card",
                categorie: "Anime",
                rarete_base: "C",
                image_url: "https://example.test/card"
              }
            ],
            count: options?.count ? 251 : null,
            error: fail ? { code: "42501" } : null
          }).then(resolve);
        }
      };
      return q;
    }
  };
  const context = {
    exports: {},
    require: n => {
      if (n === "@/lib/data/player-state") return state.exports;
      if (n === "@/utils/supabase/client")
        return { createClient: () => client };
      if (n === "@/lib/ui/card-search")
        return {
          cardSearchTerms: q =>
            q.trim().toLowerCase().split(/\s+/).filter(Boolean)
        };
      assert.fail(n);
    }
  };
  vm.runInNewContext(compile("../lib/data/cards.ts"), context);
  return {
    api: context.exports,
    calls,
    tick: n => {
      now += n;
    },
    fail: v => {
      fail = v;
    }
  };
}

test("catalogue keeps exact totals and fresh page rows while reusing counts only for identical filters", async () => {
  const s = setup();
  for (let page = 1; page <= 3; page++) {
    const result = await s.api.getCataloguePage({ page });
    assert.equal(result.total, 251);
    assert.equal(result.cards[0].id, String((page - 1) * 24));
  }
  assert.equal(s.calls.length, 3);
  assert.equal(s.calls.filter(c => c.count === "exact").length, 1);
  assert.ok(s.calls.every(c => c.orders.join() === "nom,id"));
  await s.api.getCataloguePage({ pageSize: 48 });
  assert.equal(s.calls.at(-1).count, undefined);
  for (const filter of [
    { query: "card anime" },
    { category: "Anime" },
    { rarity: "SR" }
  ])
    await s.api.getCataloguePage(filter);
  assert.deepEqual(
    JSON.parse(JSON.stringify(s.calls[4].filters)),
    [
      "nom.ilike.%card%,franchise.ilike.%card%",
      "nom.ilike.%anime%,franchise.ilike.%anime%"
    ],
    "one OR per term, combined with AND by PostgREST"
  );
  assert.equal(s.calls.filter(c => c.count === "exact").length, 4);
  s.tick(30001);
  await s.api.getCataloguePage();
  assert.equal(s.calls.at(-1).count, "exact");
  s.fail(true);
  await assert.rejects(s.api.getCataloguePage({ query: "retry" }));
  s.fail(false);
  await s.api.getCataloguePage({ query: "retry" });
  assert.equal(s.calls.at(-1).count, "exact");
});

test("catalogue substring searches use trigram indexes without changing results", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());
  const indexes = (
    await db.query(
      "select indexdef from pg_indexes where schemaname='public' and tablename='cards'"
    )
  ).rows;
  for (const column of ["nom", "franchise"])
    assert.ok(
      indexes.some(i =>
        i.indexdef.includes(`(${column} extensions.gin_trgm_ops)`)
      )
    );
  await db.exec(`insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    select 'perf-'||i,case when i%1000=0 then 'UniqueNeedle '||i else 'Ordinary '||i end,'Anime/Manga','Series '||i,'C','https://example.test/card','test' from generate_series(1,20000)i;
    analyze public.cards;`);
  await db.exec("vacuum analyze public.cards");
  const sql =
    "select id,nom from public.cards where nom ilike '%UniqueNeedle%' or franchise ilike '%UniqueNeedle%' order by nom,id";
  await db.exec("set enable_bitmapscan=off;set enable_indexscan=off");
  const baseline = (await db.query(`explain (analyze,format json) ${sql}`))
    .rows[0]["QUERY PLAN"];
  const before = (await db.query(sql)).rows;
  await db.exec("reset enable_bitmapscan;reset enable_indexscan");
  const plan = (await db.query(`explain (analyze,format json) ${sql}`)).rows[0][
    "QUERY PLAN"
  ];
  assert.match(JSON.stringify(plan), /cards_(nom|franchise)_trgm/);
  assert.deepEqual((await db.query(sql)).rows, before);
  assert.equal(before.length, 20);
  t.diagnostic(
    `20,000 cards: sequential ${baseline[0]["Execution Time"]} ms -> indexed ${plan[0]["Execution Time"]} ms; identical 20 results`
  );
});
