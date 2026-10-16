import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("bubble boosters are used both in the picker and the two tear layers", () => {
  const source = read("components/boosters.tsx");
  for (const name of ["regular", "decisive"]) {
    const path = `/assets/bubble-${name}-booster-v1.png`;
    assert.equal(source.split(path).length - 1, 3);
  }
  for (const part of ["body", "top"]) {
    assert.match(
      source,
      new RegExp(
        `className="yk-pack-tear-${part}" src=\\{drawKind === "decision" \\? "/assets/bubble-decisive-booster-v1.png" : "/assets/bubble-regular-booster-v1.png"\\}`
      )
    );
  }
});

test("shared card backs use the matching bubble artwork", () => {
  assert.match(
    read("styles/cards.css"),
    /url\("\/assets\/bubble-card-back-v1\.png"\) center \/ cover\s+no-repeat/
  );
});

for (const [name, width, height] of [
  ["regular-booster", 1024, 1536],
  ["decisive-booster", 1024, 1536],
  ["card-back", 1060, 1484]
]) {
  test(`${name} asset preserves its native PNG dimensions`, () => {
    const png = readFileSync(
      new URL(`../public/assets/bubble-${name}-v1.png`, import.meta.url)
    );
    assert.deepEqual(
      png.subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  });
}
