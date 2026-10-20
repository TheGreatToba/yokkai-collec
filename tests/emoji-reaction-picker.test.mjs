import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const testModule = { exports: {} };
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText;
  vm.runInNewContext(js, {
    module: testModule,
    exports: testModule.exports,
    require: name => (name in mocks ? mocks[name] : require(name))
  });
  return testModule.exports;
}
const catalog = load("lib/ui/reaction-emojis.ts");
function render(query = "", category = "All") {
  const states = [true, query, category];
  let index = 0;
  const { EmojiReactionPicker } = load("components/emoji-reaction-picker.tsx", {
    react: { ...React, useState: () => [states[index++], () => {}] },
    "@/components/ui": {
      Modal: ({ children, title }) =>
        React.createElement("section", { "aria-label": title }, children)
    },
    "@/lib/ui/reaction-emojis": catalog
  });
  return renderToStaticMarkup(
    React.createElement(EmojiReactionPicker, {
      disabled: false,
      selected: ["fire"],
      onSelect: () => {}
    })
  );
}
test("reaction catalogue and server whitelist match exactly and contain no duplicate IDs", () => {
  const ids = Array.from(catalog.REACTION_EMOJIS, item => item.id);
  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, ids.length);
  const sql = readFileSync(
    "supabase/migrations/20261021020000_wall_emoji_reactions.sql",
    "utf8"
  );
  const checked = Array.from(
    sql
      .match(/check\(emoji=any\(array\[([\s\S]*?)\]\)\)/)[1]
      .matchAll(/'([^']+)'/g),
    m => m[1]
  );
  assert.deepEqual(checked.sort(), ids.sort());
  assert.equal(catalog.reactionEmoji("unknown"), undefined);
});
test("picker shows named emojis, selected state, category/search filtering and an empty result", () => {
  const html = render();
  assert.equal((html.match(/aria-label="React with /g) ?? []).length, 24);
  assert.match(html, /Search reactions/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="React with Fire" aria-pressed="true"/);
  assert.equal(
    (render("fire").match(/aria-label="React with /g) ?? []).length,
    1
  );
  assert.equal(
    (render("", "Faces").match(/aria-label="React with /g) ?? []).length,
    8
  );
  assert.match(render("no-such-emoji"), /No matching emojis/);
});
