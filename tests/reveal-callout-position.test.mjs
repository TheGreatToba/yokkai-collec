import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const root = postcss.parse(
  readFileSync(new URL("../styles/boosters.css", import.meta.url), "utf8")
);
const rules = root.nodes.filter(node => node.type === "rule");
const rule = selector => ({
  nodes: rules
    .filter(node =>
      node.selectors.some(value => value.replace(/\s+/g, " ") === selector)
    )
    .flatMap(node => node.nodes)
});
const value = (rule, prop) =>
  rule.nodes.findLast(node => node.prop === prop)?.value;

test("SSR and LR callouts are centered relative to the cinematic card", () => {
  for (const rarity of ["ssr", "lr"]) {
    const callout = rule(`.yk-reveal-${rarity} > .yk-callout`);
    assert.match(
      value(callout, "top"),
      /50% - var\(--reveal-card-half-height\)/
    );
    assert.match(value(callout, "top"), /max\(12px/);
    assert.equal(value(callout, "text-align"), "center");
    assert.equal(value(callout, "margin"), "0");
    assert.equal(
      value(rule(`.yk-reveal-${rarity} .yk-deck`), "width"),
      "var(--reveal-cinematic-width)"
    );
  }
});

test("shiny keeps a separate centered line without sharing the rarity label position", () => {
  const rarity = rule(
    ".yk-reveal-stage:is(.yk-reveal-ssr, .yk-reveal-lr).yk-reveal-shiny > .yk-callout"
  );
  const shiny = rule(
    ".yk-reveal-stage:is(.yk-reveal-ssr, .yk-reveal-lr) > .yk-shiny-callout"
  );
  assert.match(value(rarity, "top"), /- 98px/);
  assert.match(value(shiny, "top"), /- 64px/);
  assert.equal(value(shiny, "text-align"), "center");
  assert.equal(value(shiny, "margin"), "0");
  assert.ok(
    root.nodes.some(
      node =>
        node.type === "atrule" &&
        node.params === "(max-height: 420px)" &&
        node.nodes.some(child =>
          child.nodes?.some(
            d =>
              d.prop === "--reveal-cinematic-width" && d.value.includes("24svh")
          )
        )
    )
  );
});
