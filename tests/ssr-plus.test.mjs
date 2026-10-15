import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const read = file => readFileSync(path.join(root, file), "utf8");
function load(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText,
    {
      exports,
      require(name) {
        if (name.endsWith(".css")) return {};
        if (name.startsWith("@/")) {
          const base = name.slice(2);
          const target = [base, `${base}.ts`, `${base}.tsx`].find(candidate =>
            existsSync(path.join(root, candidate))
          );
          assert.ok(target, name);
          return load(target);
        }
        return require(name);
      }
    }
  );
  return exports;
}
const { YokaiCard } = load("components/yokai-card.tsx");
const props = {
  name: "Spirit",
  category: "ANIME/MANGA",
  anime: "Yokkai",
  image: "/assets/card-back.png"
};
const render = extra =>
  renderToStaticMarkup(React.createElement(YokaiCard, { ...props, ...extra }));

test("SSR+ retains the SSR rarity, holographic layers and a plus badge, not a star badge", () => {
  const html = render({ rarity: "SSR", shiny: true });
  assert.match(html, /yk-rarity-SSR yk-shiny yk-ssr-plus yk-animated/);
  assert.match(html, /aria-label="Spirit, SSR\+, Yokkai"/);
  assert.match(html, /class="yk-card-badge">SSR<\/span>/);
  assert.match(html, /class="yk-shiny-badge"[^>]*>\+<\/span>/);
  assert.doesNotMatch(
    html,
    /class="yk-shiny-badge"[^>]*>✦<\/span>|SSR Shiny|yk-rarity-UR/
  );
  assert.match(html, /yk-shiny-frame/);
  assert.match(html, /yk-holo/);
  assert.equal((html.match(/class="yk-sparkle"/g) ?? []).length, 8);
});

test("normal SSR and LR Shiny keep their own identities", () => {
  const normal = render({ rarity: "SSR", shiny: false });
  assert.doesNotMatch(normal, /yk-ssr-plus|yk-shiny-frame|yk-shiny-badge/);
  const lr = render({ rarity: "LR", shiny: true });
  assert.match(lr, /yk-rarity-LR yk-shiny/);
  assert.match(lr, /class="yk-shiny-badge"[^>]*>✦<\/span>/);
  assert.match(lr, /aria-label="Spirit, LR ✦ Shiny, Yokkai"/);
  assert.doesNotMatch(lr, /yk-ssr-plus/);
  for (const rarity of ["C", "R", "SR"]) {
    assert.doesNotMatch(
      render({ rarity, shiny: true }),
      /yk-ssr-plus|yk-shiny-frame|yk-shiny-badge/
    );
  }
});

test("SSR+ keeps pink frame/glow/badges, without disabling foil animations", () => {
  const css = read("styles/cards.css");
  const block = css.match(/\.yk-ssr-plus \{([^}]+)\}/)?.[1];
  assert.ok(block);
  assert.match(block, /--holo-glow: rgba\(255, 95, 168, 0\.55\)/);
  assert.match(block, /--holo-frame: conic-gradient\([\s\S]*?#ff5fa8/);
  assert.match(block, /--holo-badge: var\(--card-badge\)/);
  assert.match(
    css,
    /\.yk-ssr-plus \.yk-shiny-frame \{[^}]*mix-blend-mode: normal;[^}]*opacity: 1;/
  );
  assert.match(css, /animation: yk-holo 4\.5s/);
  assert.match(css, /animation: yk-shiny-glint 3\.2s/);
  const still = render({ rarity: "SSR", shiny: true, animated: false });
  assert.match(still, /yk-ssr-plus/);
  assert.doesNotMatch(still, /yk-animated|yk-sparkle/);
});

test("SSR+ uses the existing SSR data model, copy grouping and rarity order", () => {
  const { cardVariantLabel } = load("lib/ui/card-variant.ts");
  assert.equal(cardVariantLabel("SSR", true), "SSR+");
  assert.equal(cardVariantLabel("SSR", false), "SSR");
  assert.equal(cardVariantLabel("LR", true), "LR ✦ Shiny");
  assert.doesNotMatch(read("lib/data/cards.ts"), /\| "UR"/);
  assert.doesNotMatch(read("styles/card-tokens.css"), /\.yk-rarity-UR/);
  assert.match(read("lib/ui/collection-groups.ts"), /card\.shiny/);
  assert.match(
    read("lib/ui/collection-sort.ts"),
    /Number\(b\.shiny\) - Number\(a\.shiny\)/
  );
  const sql = read(
    "supabase/migrations/20261003000002_evolve_ssr_five_copies.sql"
  );
  assert.match(sql, /cardinality\(p_card_instance_ids\) <> 5/);
  assert.match(sql, /count\(distinct id\)[\s\S]*?<> 5/);
  assert.match(sql, /'SSR',true,true,false/);
  assert.match(sql, /'shiny',true/);
});

test("shared images use pink SSR tokens and display SSR+ while LR retains the holographic palette", () => {
  const source = read("lib/server/card-share-image.tsx");
  assert.match(source, /const lrShiny = shiny && rarity === "LR"/);
  assert.match(
    source,
    /lrShiny\s*\? variable\(source, "--holo-frame"\)\s*: variable\(block, "--card-frame"\)/
  );
  assert.match(
    source.replace(/\s+/g, " "),
    /card\.rarity === "SSR" && card\.shiny \? "SSR\+"/
  );
});
