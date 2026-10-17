import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = file => readFileSync(resolve(root, file), "utf8");
const compiled = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source("lib/premium/banner-example.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { exports: compiled.exports, module: compiled }
);
const example = compiled.exports.PREMIUM_BANNER_EXAMPLE;

test("animated banner example uses BBDOU's local media and recorded framing", () => {
  assert.equal(example.name, "BBDOU");
  assert.deepEqual(JSON.parse(JSON.stringify(example.frame)), {
    x: 50,
    y: 28,
    zoom: 1.00569485149972,
    rotation: 0
  });
  for (const path of [example.avatar, example.animated, example.still]) {
    assert.match(
      path,
      /^\/assets\/premium-examples\/bbdou-[a-z-]+\.(?:gif|webp|jpeg)$/
    );
    assert.ok(readFileSync(resolve(root, `public${path}`)).length > 0);
  }
  const gif = readFileSync(resolve(root, `public${example.animated}`));
  assert.match(gif.toString("ascii", 0, 6), /^GIF8[79]a$/);
  assert.equal(gif.readUInt16LE(6), 498);
  assert.equal(gif.readUInt16LE(8), 281);
  assert.ok(
    gif.includes(Buffer.from("NETSCAPE2.0")),
    "The original looping GIF must be preserved"
  );
});

test("banner preview replaces only the visible simulator, not the hero or plan comparison", () => {
  const ui = source("components/premium-experience.tsx");
  assert.match(ui, /<PremiumBannerPreview\s*\/>/);
  assert.doesNotMatch(ui, /PremiumPlanPreview|yk-pro-simulator/);
  assert.match(ui, /className="yk-premium-hero"/);
  assert.match(ui, /className="yk-pro-comparison"/);
});

test("preview preserves the GIF and uses shared profile framing with motion controls", () => {
  const preview = source("components/premium-banner-preview.tsx").replace(
    /\s+/g,
    " "
  );
  assert.match(preview, /bannerGeometry\(498 \/ 281, example.frame\)/);
  assert.match(preview, /<Image/);
  assert.match(preview, /\bunoptimized\b/);
  assert.match(preview, /playing \? example.animated : example.still/);
  assert.match(preview, /prefers-reduced-motion: reduce/);
  assert.match(preview, /useSyncExternalStore/);
  assert.match(preview, /serverMotionPreference = \(\) => true/);
  assert.match(preview, /aria-pressed=\{playing\}/);
  assert.match(preview, /"Pause GIF" : "Play GIF"/);
  assert.match(preview, /Banner preview unavailable/);
  assert.match(preview, /No profile changes or Pro access are applied/);
  assert.doesNotMatch(preview, /fetch\(|\.rpc\(|localStorage|https?:\/\//);
});
