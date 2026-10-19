import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";
import sharp from "sharp";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("the supplied nebula is scoped to the regular pack opening", async () => {
  const source = read("components/boosters.tsx");
  assert.match(source, /setOpeningKind\(kind\)/);
  assert.match(
    source,
    /yk-opening-\$\{openingPhase\} yk-opening-kind-\$\{openingKind\}/
  );

  const css = read("styles/pack-tear.css");
  const root = postcss.parse(css);
  const rule = root.nodes.find(
    node =>
      node.type === "rule" &&
      node.selector ===
        ".yk-opening-stage.yk-opening-kind-regular:has(.yk-pack-tear)"
  );
  assert.ok(rule);
  const background = rule.nodes.find(node => node.prop === "background");
  assert.match(background.value, /regular-opening-nebula\.webp/);
  assert.doesNotMatch(rule.selector, /decision/);

  const metadata = await sharp(
    readFileSync(
      new URL("../public/assets/regular-opening-nebula.webp", import.meta.url)
    )
  ).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1672);
  assert.equal(metadata.height, 941);
});
