import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = path =>
  ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText;
const catalogue = ["SSR", "LR", "SSR", "LR", "SSR", "SSR", "LR"].map(
  (rarity, i) => ({
    id: `real-card-${i}`,
    name: `Character ${i}`,
    rarity,
    category: "ANIME/MANGA",
    anime: `Franchise ${i}`,
    image: `https://images.example.test/card-${i}.jpg`
  })
);

function preview(cards) {
  const Boosters = Symbol("Boosters");
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports: {},
    Date,
    require: name => {
      if (name === "react/jsx-runtime")
        return { jsx, jsxs: jsx, Fragment: Symbol("Fragment") };
      if (name === "react") return { useState: value => [value, () => {}] };
      if (name === "@/components/boosters") return { Boosters };
      if (name === "@/components/ui") return { Button: Symbol("Button") };
      throw Error(`Unexpected dependency ${name}`);
    }
  };
  vm.runInNewContext(compile("components/boosters-preview.tsx"), context);
  const tree = context.exports.BoostersPreview({ catalogue: cards });
  return {
    tree,
    packs: Array.isArray(tree.props.children)
      ? tree.props.children.find(child => child.type === Boosters)?.props
      : undefined
  };
}

test("local demo draws keep actual catalog names, franchises, images and rarity without duplicates", async () => {
  const { packs } = preview(catalogue);
  for (const kind of ["regular", "decision"])
    for (let n = 0; n < 10; n++) {
      const cards = await packs.onOpen(kind);
      assert.equal(cards.length, 5);
      assert.equal(new Set(cards.map(card => card.id)).size, 5);
      assert.equal(cards.filter(card => card.rarity === "SSR").length, 3);
      assert.equal(cards.filter(card => card.rarity === "LR").length, 2);
      for (const card of cards) {
        const actual = catalogue.find(item => item.id === card.id);
        assert.ok(actual);
        for (const key of [
          "id",
          "name",
          "category",
          "anime",
          "rarity",
          "image"
        ])
          assert.equal(card[key], actual[key]);
        assert.equal(card.shiny, false);
        assert.ok(card.instanceId.startsWith("preview-"));
      }
    }
});

test("an empty or incomplete local catalogue shows an error rather than invented cards", () => {
  for (const cards of [[], catalogue.filter(card => card.rarity === "SSR")]) {
    const { tree, packs } = preview(cards);
    assert.equal(tree.props.role, "alert");
    assert.match(tree.props.children, /local catalog/);
    assert.equal(packs, undefined);
  }
});

function loader(environment, url, fail = false) {
  const reads = [];
  let cookieReads = 0;
  const context = {
    exports: {},
    URL,
    process: { env: { NODE_ENV: environment } },
    require: name => {
      if (name === "server-only") return {};
      if (name === "next/headers")
        return {
          cookies: async () => {
            cookieReads++;
            return {};
          }
        };
      if (name === "@/utils/supabase/config")
        return { getSupabaseConfig: () => ({ url }) };
      if (name === "@/utils/supabase/server")
        return {
          createClient: () => ({
            from: table => {
              assert.equal(table, "cards");
              let rarity;
              const query = {
                select: fields => {
                  assert.equal(
                    fields,
                    "id,nom,categorie,franchise,rarete_base,image_url"
                  );
                  return query;
                },
                eq: (column, value) => {
                  assert.equal(column, "rarete_base");
                  rarity = value;
                  return query;
                },
                not: () => query,
                neq: () => query,
                order: () => query,
                limit: async maximum => {
                  reads.push({ rarity, maximum });
                  return {
                    error: fail ? {} : null,
                    data: catalogue
                      .filter(card => card.rarity === rarity)
                      .map(card => ({
                        id: card.id,
                        nom: card.name,
                        categorie: card.category,
                        franchise: card.anime,
                        rarete_base: card.rarity,
                        image_url: card.image
                      }))
                  };
                }
              };
              return query;
            }
          })
        };
      throw Error(`Unexpected dependency ${name}`);
    }
  };
  vm.runInNewContext(compile("lib/data/local-booster-catalogue.ts"), context);
  return {
    load: context.exports.getLocalBoosterCatalogue,
    reads,
    cookies: () => cookieReads
  };
}

test("preview loader never connects in production or to a remote database", async () => {
  for (const [env, url] of [
    ["production", "http://127.0.0.1:54321"],
    ["development", "https://api.example.test"]
  ]) {
    const fixture = loader(env, url);
    assert.equal((await fixture.load()).length, 0);
    assert.equal(fixture.reads.length, 0);
    assert.equal(fixture.cookies(), 0);
  }
});

test("local preview loader reads only bounded SSR/LR catalog metadata", async () => {
  const fixture = loader("development", "http://127.0.0.1:54321");
  const cards = await fixture.load();
  assert.equal(fixture.reads.length, 2);
  assert.deepEqual(fixture.reads.map(read => read.rarity).sort(), [
    "LR",
    "SSR"
  ]);
  assert.ok(fixture.reads.every(read => read.maximum === 250));
  assert.equal(cards.length, catalogue.length);
  for (const card of cards)
    assert.equal(
      card.image,
      catalogue.find(actual => actual.id === card.id).image
    );
});

test("catalog query errors are surfaced instead of silently inventing cards", async () => {
  await assert.rejects(
    loader("development", "http://127.0.0.1:54321", true).load(),
    /local card catalog/
  );
});
