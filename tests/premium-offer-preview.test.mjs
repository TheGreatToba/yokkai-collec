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
  ts.transpileModule(source("lib/premium/offer.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { module: compiled, exports: compiled.exports }
);
const {
  PROPOSED_PLAN_RULES: rules,
  PROPOSED_PRO_FEATURES: features,
  previewAvailability
} = compiled.exports;

test("proposed Basic and Pro rules match the requested limits", () => {
  assert.equal(rules.basic.regularPackMinutes, 10);
  assert.equal(rules.pro.regularPackMinutes, 5);
  assert.equal(rules.basic.decisionPackHours, 24);
  assert.equal(rules.pro.decisionPackHours, 12);
  assert.equal(rules.basic.concurrentAuctions, 3);
  assert.equal(rules.pro.concurrentAuctions, 6);
  assert.equal(rules.basic.showcaseSlots, 5);
  assert.equal(rules.pro.showcaseSlots, 10);
});

test("local simulation respects pack readiness boundaries without granting inventory", () => {
  for (const plan of ["basic", "pro"]) {
    const regular = rules[plan].regularPackMinutes;
    const decision = rules[plan].decisionPackHours * 60;
    assert.equal(previewAvailability(plan, regular - 1).regularReady, false);
    assert.equal(previewAvailability(plan, regular).regularReady, true);
    assert.equal(previewAvailability(plan, decision - 1).decisionReady, false);
    assert.equal(previewAvailability(plan, decision).decisionReady, true);
    for (const invalid of [-100, NaN, Infinity]) {
      assert.equal(previewAvailability(plan, invalid).regularReady, false);
      assert.equal(previewAvailability(plan, invalid).decisionReady, false);
    }
  }
  assert.equal(previewAvailability("basic", 5).regularReady, false);
  assert.equal(previewAvailability("pro", 5).regularReady, true);
  assert.equal(previewAvailability("basic", 720).decisionReady, false);
  assert.equal(previewAvailability("pro", 720).decisionReady, true);
});

test("all requested benefits are represented and Karas rewards are not invented", () => {
  assert.deepEqual(
    Array.from(features, feature => feature.id),
    [
      "card-art",
      "regular-packs",
      "decision-packs",
      "auctions",
      "achievements",
      "site-background",
      "banners",
      "avatar-gifs",
      "showcase",
      "pro-badge",
      "frames",
      "profile-themes",
      "showcase-effects"
    ]
  );
  assert.match(
    features.find(feature => feature.id === "card-art").detail,
    /Imgur or Pinterest/
  );
  assert.match(
    features.find(feature => feature.id === "achievements").detail,
    /Karas/
  );
  assert.match(
    features.find(feature => feature.id === "achievements").detail,
    /still to be defined/
  );
});

test("offer preview stays isolated and explicitly distinguishes planned features from active rights", () => {
  const preview = source("components/premium-plan-preview.tsx");
  const offer = source("lib/premium/offer.ts");
  const ui = source("components/premium-experience.tsx").replace(/\s+/g, " ");
  const server = source("lib/premium/server.ts");
  assert.doesNotMatch(preview, /fetch\(|\.rpc\(|localStorage|supabase/);
  assert.doesNotMatch(offer, /fetch\(|\.rpc\(|localStorage|supabase/);
  assert.doesNotMatch(server, /PROPOSED_PLAN_RULES|previewAvailability/);
  assert.match(preview, /Simulation only/);
  assert.match(preview, /disabled=\{auctions >= rules.concurrentAuctions\}/);
  assert.match(ui, /not yet connected to public profiles or game\s+rules/);
  assert.match(ui, /rarity odds per card stay the same/);
  assert.doesNotMatch(
    ui,
    /Personalization only|No gameplay advantage|No extra packs/
  );
});
