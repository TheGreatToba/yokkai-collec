import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../components/native-card-drop-preview.tsx", import.meta.url),
  "utf8"
);
const context = {
  exports: {},
  require(name) {
    if (name === "@/components/boosters")
      return {
        BoosterReveal() {
          assert.fail("Closed pack must not render the reveal");
        }
      };
    return require(name);
  }
};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText,
  context
);

test("demo pack contains exactly SR, SSR and LR with three distinct local characters", () => {
  const cards = context.exports.NATIVE_DROP_DEMO_CARDS;
  assert.deepEqual(
    Array.from(cards, card => card.rarity),
    ["SR", "SSR", "LR"]
  );
  assert.equal(new Set(cards.map(card => card.id)).size, 3);
  assert.equal(new Set(cards.map(card => card.name)).size, 3);
  for (const card of cards) assert.match(card.image, /^\/assets\/landing\//);
});

test("demo starts closed, offers one pack and explicitly spends no real resources", () => {
  const html = renderToStaticMarkup(
    React.createElement(context.exports.NativeCardDropPreview)
  );
  assert.match(html, /Open demo pack/);
  assert.match(html, /SR \+ SSR \+ LR demo pack/);
  assert.match(html, /No booster or Karas spent/);
  assert.doesNotMatch(
    source,
    /createClient|rpc\(|openPack\(|openRegularPack\(/
  );
  assert.match(source, /onNext=\{replay\}/);
  assert.match(source, /current === index \? current \+ 1 : current/);
});
