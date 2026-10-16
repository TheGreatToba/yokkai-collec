import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const source = readFileSync(
  new URL("../styles/boosters-showcase.css", import.meta.url),
  "utf8"
);
const root = postcss.parse(source);
const rule = selector =>
  root.nodes.find(node => node.type === "rule" && node.selector === selector);
const value = (selector, property) =>
  rule(selector)?.nodes.find(node => node.prop === property)?.value;
const panels = ".yk-pack-grid .yk-pack-panel";

test("both pack panels share the approved dark blue/lavender theme and pale border", () => {
  assert.equal(value(panels, "--pack-accent"), "#c0c5ff");
  assert.equal(value(panels, "color"), "#eeebff");
  assert.equal(value(panels, "border-color"), "#a6aceb42");
  const background = value(panels, "background");
  for (const color of ["#1b1d35", "#151424", "#1c1830"])
    assert.ok(background.includes(color));
  assert.doesNotMatch(background, /#fbfaff|#e9e7f8|#f5f2ff/);
  assert.equal(
    value(`${panels} .yk-pack-body > .yk-button`, "color"),
    "#eeeaff"
  );
  assert.match(
    value(`${panels} .yk-pack-body > .yk-button`, "background"),
    /#4a436f[\s\S]*#36476d/
  );
  assert.doesNotMatch(source, /url\(|yk-opening|yk-reveal/);
});

test("the shared pack theme covers badges, image glow, readable status and disabled controls", () => {
  for (const suffix of [
    ".yk-pack-art-stage",
    ".yk-pack-image",
    ".yk-pack-info",
    ".yk-pack-status",
    ".yk-pack-status .text-success",
    ".yk-pack-status .text-warning",
    ".yk-pack-body > .yk-button:disabled"
  ])
    assert.ok(rule(`${panels} ${suffix}`), suffix);
  assert.equal(
    value(`${panels} .yk-pack-status .text-success`, "color"),
    "#72d6bc"
  );
  assert.ok(
    root.nodes.some(
      node =>
        node.type === "atrule" &&
        node.params.includes("hover: hover") &&
        node.nodes.some(child => child.selector === `${panels}:hover`)
    )
  );
});
