import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const compile = source =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText;
const read = name =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

test("collection reload uses the owned UR rather than the SSR catalogue rarity", async () => {
  const source = read("lib/data/cards.ts");
  const ast = ts.createSourceFile(
    "cards.ts",
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const functions = ast.statements
    .filter(
      n =>
        ts.isFunctionDeclaration(n) &&
        ["getUserCollection", "cardFromRow"].includes(n.name?.text)
    )
    .map(n => n.getText(ast))
    .join("\n");
  let selected;
  const rows = ["SSR", "UR"].map((rarity, i) => ({
    id: `copy-${i}`,
    rarity,
    date_obtention: "2026-10-15T10:00:00Z",
    is_shiny: false,
    is_evolved: rarity === "UR",
    cards: {
      id: "base",
      nom: "Same card",
      categorie: "ANIME/MANGA",
      rarete_base: "SSR",
      image_url: "/card.png"
    }
  }));
  const query = {
    select: fields => {
      selected = fields;
      return query;
    },
    eq: () => query,
    order: () => query,
    limit: () => query,
    abortSignal: async () => ({ data: rows, error: null })
  };
  const context = {
    exports: {},
    db: () => ({
      from: table => {
        assert.equal(table, "user_cards");
        return query;
      }
    }),
    playerId: async () => "alice",
    assertPlayer: async () => {},
    cache: { memo: (_key, _ttl, load) => load() },
    PLAYER_SNAPSHOT_TTL: { collection: 0 },
    collectionPages: new Map(),
    PAGE_SIZE: 500,
    cardFields: "id,nom,categorie,franchise,rarete_base,image_url",
    rank: { C: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5 },
    resumePages: (_state, _size, read) => read(),
    readRequest: read => read(),
    Date
  };
  vm.runInNewContext(compile(functions), context);
  const cards = await context.exports.getUserCollection();
  assert.match(selected, /(?:^|,)rarity(?:,|$)/);
  assert.deepEqual(
    Array.from(cards, c => c.rarity),
    ["UR", "SSR"]
  );
  assert.equal(cards[0].isEvolved, true);
});

test("UR sorts between LR and SSR and is not grouped with SSR copies", () => {
  const load = name => {
    const ctx = { exports: {}, require: () => ({}) };
    vm.runInNewContext(compile(read(name)), ctx);
    return ctx.exports;
  };
  const cards = ["SSR", "UR", "LR"].map((rarity, i) => ({
    id: "same-card",
    instanceId: `copy-${i}`,
    name: "Same",
    rarity,
    shiny: false,
    obtainedAt: "2026-10-15T10:00:00Z"
  }));
  assert.deepEqual(
    Array.from(
      load("lib/ui/collection-sort.ts").sortCollection(cards, "rarity"),
      c => c.rarity
    ),
    ["LR", "UR", "SSR"]
  );
  assert.equal(
    load("lib/ui/collection-groups.ts").groupCollection(cards).length,
    3
  );
});

test("the new client refuses to consume SSRs while the server still has the legacy Shiny rule", async () => {
  const source = read("lib/data/cards.ts");
  const ast = ts.createSourceFile(
    "cards.ts",
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const fn = ast.statements.find(
    n => ts.isFunctionDeclaration(n) && n.name?.text === "evolveSsrCard"
  );
  let available = false,
    calls = 0;
  const ctx = {
    exports: {},
    playerId: async () => "alice",
    assertPlayer: async () => {},
    getGameInfo: async () => ({
      rarities: available ? ["SSR", "UR"] : ["SSR"]
    }),
    db: () => ({
      rpc: async () => {
        calls++;
        return { data: { rarity: "UR" }, error: null };
      }
    }),
    withLiveCardFranchises: async cards => cards,
    cache: { delete: () => {} },
    collectionPages: new Map()
  };
  vm.runInNewContext(compile(fn.getText(ast)), ctx);
  await assert.rejects(
    ctx.exports.evolveSsrCard(["1", "2", "3", "4", "5"]),
    /UR evolution is not available/
  );
  assert.equal(calls, 0);
  available = true;
  assert.equal(
    (await ctx.exports.evolveSsrCard(["1", "2", "3", "4", "5"])).rarity,
    "UR"
  );
  assert.equal(calls, 1);
});

test("UR has its own accessible card frame, not the shiny overlay", () => {
  const ctx = {
    exports: {},
    require: name => (name.endsWith(".css") ? {} : require(name))
  };
  vm.runInNewContext(compile(read("components/yokai-card.tsx")), ctx);
  const html = renderToStaticMarkup(
    React.createElement(ctx.exports.YokaiCard, {
      name: "Fusion",
      rarity: "UR",
      category: "Anime",
      shiny: false,
      animated: false
    })
  );
  assert.match(html, /yk-rarity-UR/);
  assert.match(html, /Fusion, UR/);
  assert.doesNotMatch(html, /yk-shiny|Shiny/);
  assert.match(
    read("styles/card-tokens.css"),
    /\.yk-rarity-UR\s*\{[^}]*--card-frame:[^}]*--card-badge:/
  );
});
