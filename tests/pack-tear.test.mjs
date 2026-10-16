import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";
import { assertTearAssets, imageAsset } from "./helpers/visual-assets.mjs";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("components/boosters.tsx");
const css = read("styles/pack-tear.css");
const opening = source.slice(
  source.indexOf("{opening ?"),
  source.indexOf(": revealing ?")
);

test("native tear uses two copies of the active pack and decorative gold sparks, not a video", () => {
  for (const part of ["body", "top"]) {
    assert.match(
      opening,
      new RegExp(
        `className="yk-pack-tear-${part}" src=\\{drawKind === "decision"`
      )
    );
  }
  assertTearAssets(
    opening,
    imageAsset(source, "yk-pack-image yk-decision-image"),
    imageAsset(source, "yk-pack-image")
  );
  assert.match(opening, /yk-pack-tear-sparks/);
  assert.match(opening, /yk-pack-tear-glow/);
  assert.match(opening, /yk-pack-tear" aria-hidden="true"/);
  assert.doesNotMatch(
    opening,
    /<video|<iframe|dangerouslySetInnerHTML|data:image/
  );
  assert.match(read("app/layout.tsx"), /import "\.\.\/styles\/pack-tear\.css"/);
});

test("only the torn top moves away once the server-driven seal phase starts", () => {
  const root = postcss.parse(css);
  const rules = root.nodes.filter(node => node.type === "rule");
  for (const part of ["body", "top"]) {
    const rule = rules.find(node => node.selector === `.yk-pack-tear-${part}`);
    assert.ok(
      rule.nodes.some(
        node => node.prop === "clip-path" && node.value.startsWith("polygon(")
      )
    );
  }
  const top = rules.find(
    node => node.selector === ".yk-opening-seal .yk-pack-tear-top"
  );
  const animation = top.nodes.find(node => node.prop === "animation").value;
  assert.match(animation, /yk-pack-tear-strip var\(--pack-opening-duration\)/);
  assert.doesNotMatch(animation, /infinite/);
  assert.ok(
    !rules.some(
      node =>
        node.selector.includes("body") &&
        node.nodes.some(d => d.prop === "animation")
    )
  );
  assert.match(
    css,
    /100%\s*\{\s*transform: translate\(57%, -89%\) rotate\(47deg\);\s*opacity: 0/
  );
  assert.match(opening, /onClick=\{finishSeal\}/);
  assert.match(opening, /Skip the opening animation/);
});

test("reduced motion disables the strip, halo, seam and spark animations", () => {
  const reduced = postcss
    .parse(css)
    .nodes.find(
      node =>
        node.type === "atrule" &&
        node.params === "(prefers-reduced-motion: reduce)"
    );
  assert.ok(reduced);
  for (const selector of [
    ".yk-opening-stage .yk-pack-tear",
    ".yk-pack-tear::before",
    ".yk-pack-tear::after",
    ".yk-opening-seal .yk-pack-tear-top",
    ".yk-opening-seal .yk-pack-tear-glow",
    ".yk-pack-tear-spark"
  ]) {
    assert.ok(
      reduced.nodes.some(
        rule =>
          rule.selectors?.includes(selector) &&
          rule.nodes.some(d => d.prop === "animation" && d.value === "none")
      ),
      selector
    );
  }
  assert.doesNotMatch(css, /\.yk-reveal|\.yk-face-up|\.yk-card/);
});
