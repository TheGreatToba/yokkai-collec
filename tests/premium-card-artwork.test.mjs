import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = file => readFileSync(resolve(root, file), "utf8");
const compiled = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source("lib/premium/card-artwork-example.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { exports: compiled.exports, module: compiled }
);
const example = compiled.exports.PREMIUM_CARD_ARTWORK_EXAMPLE;

test("artwork example uses the real Gojo LR card and locally supplied GIF", () => {
  assert.equal(example.card.id, "60c0cdbe-2ed5-43f9-aac3-c2bdfa5e4867");
  assert.equal(example.card.name, "SATORU GOJOU");
  assert.equal(example.card.anime, "JUJUTSU KAISEN");
  assert.equal(example.card.category, "ANIME/MANGA");
  assert.equal(example.card.rarity, "LR");
  for (const path of [example.card.image, example.customGif, example.still]) {
    assert.match(
      path,
      /^\/assets\/premium-examples\/gojo-[a-z-]+\.(?:gif|webp|png)$/
    );
    assert.ok(readFileSync(resolve(root, `public${path}`)).length > 0);
  }
  const gif = readFileSync(resolve(root, `public${example.customGif}`));
  assert.match(gif.toString("ascii", 0, 6), /^GIF8[79]a$/);
  assert.equal(gif.readUInt16LE(6), 498);
  assert.equal(gif.readUInt16LE(8), 281);
  assert.ok(gif.includes(Buffer.from("NETSCAPE2.0")));
  assert.notEqual(example.card.image, example.customGif);
});

test("comparison preserves both card frames and only changes the illustration", () => {
  const preview = source("components/premium-card-artwork-preview.tsx").replace(
    /\s+/g,
    " "
  );
  assert.equal(
    (preview.match(/<YokaiCard \{\.\.\.example.card\}/g) ?? []).length,
    2
  );
  assert.equal((preview.match(/animated=\{false\}/g) ?? []).length, 2);
  assert.match(
    preview,
    /image=\{playing \? example.customGif : example.still\}/
  );
  assert.match(preview, /fallbackImage=\{example.card.image\}/);
  assert.match(preview, /Original artwork/);
  assert.match(preview, /Custom artwork/);
  assert.match(preview, /Same LR card. Only the illustration changes/);
  assert.match(preview, /prefers-reduced-motion: reduce/);
  assert.match(preview, /aria-pressed=\{playing\}/);
  assert.doesNotMatch(
    preview,
    /fetch\(|\.rpc\(|localStorage|shiny=|https?:\/\//
  );
});

test("artwork example sits alongside the animated banner in the current offer page", () => {
  const offer = source("components/premium-offer.tsx").replace(/\s+/g, " ");
  const css = source("styles/premium.css");
  assert.match(
    offer,
    /className="yk-pro-personalization-examples"> <PremiumBannerPreview \/> <PremiumCardArtworkPreview \/>/
  );
  assert.match(
    css,
    /\.yk-pro-personalization-examples \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(css, /@media \(max-width: 960px\)/);
});
