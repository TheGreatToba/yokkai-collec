import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("styles/boosters-showcase.css");

test("desktop pack sizing adapts to viewport height without hiding content or locking scrolling", () => {
  const root = postcss.parse(css);
  const desktop = root.nodes.find(
    node =>
      node.type === "atrule" &&
      node.params === "(min-width: 701px) and (max-height: 1200px)"
  );
  assert.ok(
    desktop,
    "compact layout applies only to shorter desktop viewports"
  );
  const declarations = [];
  desktop.walkDecls(declaration => declarations.push(declaration));
  assert.ok(
    declarations.some(
      ({ prop, value }) => prop === "height" && value.includes("100svh")
    )
  );
  assert.ok(
    declarations.some(
      ({ prop, value }) => prop === "min-height" && value === "44px"
    ),
    "opening buttons stay at least 44px tall"
  );
  for (const { prop, value } of declarations) {
    assert.notEqual(prop, "zoom");
    assert.ok(!(prop === "transform" && value.includes("scale")));
    assert.ok(
      !["hidden", "clip"].includes(value),
      "no clipping to fake fitting"
    );
    assert.ok(
      !(prop === "display" && value === "none"),
      "no hidden details or buttons"
    );
    assert.ok(
      !(prop === "height" && value === "100svh"),
      "no fixed-height page that traps overflow"
    );
  }
  desktop.walkRules(rule => {
    assert.doesNotMatch(
      rule.selector,
      /yk-reveal|yk-opening|yk-card|^body|^html/
    );
  });
});

test("browser fixture includes the same pack header, main and footer as the real page", () => {
  const page = read("app/design-system/boosters-preview/page.tsx");
  const game = read("components/game.tsx");
  for (const marker of [
    "yk-game-main",
    "yk-pack-page-heading",
    "Your next great pull.",
    "Your collection is saved to your account"
  ]) {
    assert.ok(page.includes(marker));
    assert.ok(game.includes(marker));
  }
  assert.match(page, /min-h-dvh/);
  assert.match(page, /flex-1/);
});

test("pack lighting stays decorative and buttons follow a reserved info line", () => {
  const root = postcss.parse(css);
  const declaration = (selector, prop) =>
    root.nodes
      .find(node => node.selector === selector)
      ?.nodes.find(node => node.prop === prop)?.value;
  const boosters = read("components/boosters.tsx");
  for (const name of ["ambient", "aura", "floor"]) {
    assert.ok(
      boosters.includes(`className="yk-pack-${name}" aria-hidden="true"`)
    );
    assert.equal(declaration(`.yk-pack-${name}`, "pointer-events"), "none");
    assert.match(
      declaration(`.yk-pack-${name}`, "background"),
      /radial-gradient/
    );
    assert.match(declaration(`.yk-pack-${name}`, "filter"), /blur/);
  }
  assert.equal(
    declaration(
      ".yk-pack-grid .yk-pack-panel .yk-pack-body > .yk-button",
      "margin-top"
    ),
    "0"
  );
  assert.equal(
    declaration(".yk-pack-grid .yk-pack-panel .yk-pack-status", "min-height"),
    "72px"
  );
  assert.match(
    declaration(".yk-decision-panel .yk-pack-floor", "background"),
    /var\(--color-accent-gold\)/
  );
});
