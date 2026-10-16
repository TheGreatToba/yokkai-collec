import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

test("the page canvas is pure black on the document, app and landing page", () => {
  for (const [file, selector] of [
    ["app/globals.css", "html"],
    ["styles/ui.css", "body"],
    ["styles/landing.css", ".yk-landing"]
  ]) {
    const root = postcss.parse(
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    );
    const rules = root.nodes.filter(
      node => node.type === "rule" && node.selector === selector
    );
    assert.equal(rules.length, 1, `${file}: ${selector}`);
    const background = rules[0].nodes.find(node => node.prop === "background");
    assert.equal(background?.value, "#000", `${file}: ${selector}`);
    assert.ok(
      !rules[0].nodes.some(node => node.prop === "background-image"),
      `${file}: no page-wide gradient overlay`
    );
  }
});
