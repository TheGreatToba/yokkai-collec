import assert from "node:assert/strict";
import test from "node:test";

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function simulate({ samples, thresholds, rarities, seed }) {
  const random = mulberry32(seed);
  const counts = Object.fromEntries(rarities.map((rarity) => [rarity, 0]));
  let lr = 0;
  let shiny = 0;
  for (let draw = 0; draw < samples; draw += 1) {
    const roll = random();
    const index = thresholds.findIndex((threshold) => roll < threshold);
    const rarity = rarities[index === -1 ? rarities.length - 1 : index];
    counts[rarity] += 1;
    if (rarity === "LR") {
      lr += 1;
      if (random() < 0.001) shiny += 1;
    }
  }
  return { counts, lr, shiny };
}

function assertRate(actual, expected, samples, tolerance = 0.0005) {
  assert.ok(Math.abs(actual / samples - expected) < tolerance,
    `${actual}/${samples} doit approcher ${(expected * 100).toFixed(3)} %`);
}

test("simulation massive des nouveaux taux de drop et du Shiny LR indépendant", () => {
  const samples = 5_000_000;
  const regular = simulate({
    samples,
    thresholds: [0.719, 0.919, 0.989, 0.999],
    rarities: ["C", "R", "SR", "SSR", "LR"],
    seed: 0x59a11,
  });
  for (const [rarity, rate] of Object.entries({ C: 0.719, R: 0.2, SR: 0.07, SSR: 0.01, LR: 0.001 })) {
    assertRate(regular.counts[rarity], rate, samples);
  }

  const decision = simulate({
    samples,
    thresholds: [0.978, 0.998],
    rarities: ["SR", "SSR", "LR"],
    seed: 0xdec1510,
  });
  assert.deepEqual(Object.keys(decision.counts), ["SR", "SSR", "LR"]);
  for (const [rarity, rate] of Object.entries({ SR: 0.978, SSR: 0.02, LR: 0.002 })) {
    assertRate(decision.counts[rarity], rate, samples);
  }

  // Pool enough LR draws to verify the conditional Shiny rate itself, independently of rarity.
  const lrSamples = 5_000_000;
  const random = mulberry32(0x5a1f1);
  let shiny = 0;
  for (let draw = 0; draw < lrSamples; draw += 1) if (random() < 0.001) shiny += 1;
  assertRate(shiny, 0.001, lrSamples, 0.00005);
});
