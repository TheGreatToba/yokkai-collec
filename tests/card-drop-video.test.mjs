import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(read("lib/ui/card-drop-video.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText,
  context
);
const api = context.exports;

test("each supported rarity selects its own supplied MP4, ordinary cards select none", () => {
  for (const rarity of ["SR", "SSR", "LR"]) {
    assert.equal(
      api.cardDropVideo(rarity),
      `/assets/drops/${rarity.toLowerCase()}-v1.mp4`
    );
    const bytes = readFileSync(
      new URL(`../public${api.cardDropVideo(rarity)}`, import.meta.url)
    );
    assert.ok(
      bytes.includes(Buffer.from("avc1")),
      "H.264 browser-compatible original"
    );
    assert.ok(bytes.length > 1_000_000 && bytes.length < 5_000_000);
    assert.ok(
      api.CARD_DROP_FACE_AT[rarity] > 0 && api.CARD_DROP_FACE_AT[rarity] < 10
    );
  }
  assert.equal(api.cardDropVideo("C"), null);
  assert.equal(api.cardDropVideo("R"), null);
});

test("the embedded character is always masked and the actual card is rendered separately", () => {
  const video = read("components/card-drop-cinematic.tsx");
  const css = read("styles/card-drop-cinematic.css");
  assert.match(video, /CSS\.supports\("mask-composite", "exclude"\)/);
  assert.match(video, /CSS\.supports\("-webkit-mask-composite", "xor"\)/);
  assert.match(video, /!supportsMask[\s\S]*?finish\(\)/);
  assert.match(video, /src=\{allowed \? \(cardDropVideo/);
  assert.match(
    video,
    /faceUp \? <YokaiCard \{\.\.\.card\} \/> : <CardBack \/>/
  );
  assert.match(css, /mask-composite: exclude/);
  assert.match(css, /-webkit-mask-composite: xor/);
  assert.match(css, /mask-size:\s*100% 100%,\s*32% 84%/);
  assert.match(css, /aspect-ratio: 16 \/ 9/);
  assert.match(css, /object-fit: contain/);
  assert.doesNotMatch(css, /object-fit: cover/);
});

test("cinematics cannot block the reveal or open it twice", () => {
  const video = read("components/card-drop-cinematic.tsx");
  const reveal = read("components/boosters.tsx");
  assert.match(video, /if \(finished\.current\) return/);
  assert.match(video, /finished\.current = true/);
  assert.match(video, /onEnded=\{finish\}/);
  assert.match(video, /onError=\{finish\}/);
  assert.match(video, /\.play\(\)\.catch\(finish\)/);
  assert.match(video, /Skip animation/);
  assert.match(video, /setTimeout\(finish, CARD_DROP_MAX_MS\)/);
  assert.match(video, /setTimeout\(finish, CARD_DROP_STALL_MS\)/);
  assert.match(reveal, /!current \|\| dropInProgress\.current/);
  assert.match(reveal, /if \(!dropInProgress\.current \|\| !dropCard\) return/);
  assert.match(reveal, /onClose=\{finishDropVideo\}/);
  assert.match(reveal, /onComplete=\{finishDropVideo\}/);
  assert.ok(api.CARD_DROP_MAX_MS > 10_005 && api.CARD_DROP_MAX_MS < 20_000);
});

test("audio, data saver, reduced motion and unmount preserve a safe fallback", () => {
  const source = read("components/card-drop-cinematic.tsx");
  assert.match(source, /\bmuted\b/);
  assert.match(source, /playsInline/);
  assert.match(source, /preload="none"/);
  assert.match(source, /connection\?\.saveData/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /reducedMotion\.addEventListener\("change"/);
  assert.match(source, /reducedMotion\.removeEventListener\("change"/);
  assert.match(source, /clearTimeout\(deadline\)/);
  assert.match(source, /clearStall\(\)/);
});

test("supplied animations remain byte-identical, with no recompression", () => {
  // Exact hashes of the user's source files, not regenerated design assets.
  const expected = {
    SR: "30d448e9128e359f0323f48f19cbf0a59bf344fe47460f9e985bb4543dea0882",
    SSR: "8dd7bcece370652436a1e3f57d00623b13546c643fb8a43aec625ee572b2f384",
    LR: "439a7f8d8d997ad8f5f4d7f1f5a7ea4bd2074e9078c4d392ab651c771a2e03f6"
  };
  for (const rarity of Object.keys(expected)) {
    const bytes = readFileSync(
      new URL(`../public${api.cardDropVideo(rarity)}`, import.meta.url)
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expected[rarity]
    );
  }
  assert.equal(Object.keys(expected).length, 3);
});
