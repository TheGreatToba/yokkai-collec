import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const root = postcss.parse(
  readFileSync(
    new URL("../styles/boosters-showcase.css", import.meta.url),
    "utf8"
  )
);
const rules = root.nodes.filter(node => node.type === "rule");
const rule = selector => rules.find(node => node.selector === selector);
const declaration = (selector, property) =>
  rule(selector)?.nodes.find(node => node.prop === property)?.value;
const decision = ".yk-pack-panel.yk-decision-panel";

test("the celestial Decision Pack has a pearl, blue and lavender panel instead of black and gold", () => {
  assert.equal(declaration(decision, "--pack-accent"), "#6352a3");
  assert.equal(declaration(decision, "color"), "#302747");
  const background = declaration(decision, "background");
  for (const color of ["#fbfaff", "#d9e8ff", "#e6dbff"])
    assert.ok(background.includes(color));
  assert.doesNotMatch(background, /#201a19|#100e16/);
  assert.equal(
    declaration(".yk-pack-panel", "--pack-accent"),
    "#b28af0",
    "Regular Pack keeps its palette"
  );
});

test("decision badges, image lighting, status and button use scoped celestial colors", () => {
  for (const suffix of [
    ".yk-pack-image",
    ".yk-pack-info",
    ".yk-pack-status",
    ".yk-pack-status .text-success",
    ".yk-pack-status .text-warning",
    ".yk-pack-body > .yk-button",
    ".yk-pack-body > .yk-button:disabled"
  ]) {
    assert.ok(rule(`${decision} ${suffix}`), suffix);
  }
  assert.equal(
    declaration(`${decision} .yk-pack-body > .yk-button`, "color"),
    "#3e2f66"
  );
  assert.match(
    declaration(`${decision} .yk-pack-body > .yk-button`, "background"),
    /#d7c7fa[\s\S]*#e1eaff/
  );
  assert.equal(
    declaration(`${decision} .yk-pack-status .text-success`, "color"),
    "#176454"
  );
  assert.ok(
    root.nodes.some(
      node =>
        node.type === "atrule" &&
        node.params.includes("hover: hover") &&
        node.nodes.some(child => child.selector === `${decision}:hover`)
    )
  );
});
