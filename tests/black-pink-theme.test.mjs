import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const read = path =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const palette = read("tailwind.config.ts");
const token = name => {
  const value = palette.match(
    new RegExp(`(?:"${name}"|${name}):\\s*"(#[0-9a-f]{6})"`, "i")
  )?.[1];
  assert.ok(value, `Missing palette token: ${name}`);
  return value.toUpperCase();
};
const luminance = hex => {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map(channel => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test("the supplied pink logo has the same intrinsic ratio at all three site entry points", () => {
  const logo = readFileSync(
    new URL("../public/assets/brand-logo-pink.png", import.meta.url)
  );
  assert.equal(logo.subarray(1, 4).toString(), "PNG");
  assert.equal(logo.readUInt32BE(16), 2164);
  assert.equal(logo.readUInt32BE(20), 726);
  for (const file of [
    "app/page.tsx",
    "app/(auth)/layout.tsx",
    "components/topbar.tsx"
  ]) {
    const source = read(file);
    assert.match(source, /src="\/assets\/brand-logo-pink\.png"/);
    assert.match(source, /width=\{2164\}/);
    assert.match(source, /height=\{726\}/);
  }
});

test("black and pink brand surfaces retain AA text and visible keyboard focus", () => {
  assert.equal(token("night"), "#050506");
  assert.equal(token("accent-neon"), "#F94D95");
  for (const surface of ["night", "surface", "elevated", "veil"]) {
    for (const ink of ["ink", "ink-2", "ink-3"]) {
      assert.ok(
        contrast(token(ink), token(surface)) >= 4.5,
        `${ink} on ${surface}`
      );
    }
    assert.ok(
      contrast(token("focus-ring"), token(surface)) >= 3,
      `focus on ${surface}`
    );
  }
  for (const fill of ["accent-neon", "focus-ring"]) {
    assert.ok(
      contrast(token("void"), token(fill)) >= 4.5,
      `primary text on ${fill}`
    );
  }
});

test("brand recoloring preserves rarity and semantic status colors", () => {
  for (const [name, expected] of Object.entries({
    "rarity-c": "#9097AB",
    "rarity-ssr": "#FF5FA8",
    "rarity-lr": "#E8C26A",
    success: "#00E699",
    warning: "#FF9900",
    danger: "#FF3355"
  }))
    assert.equal(token(name), expected);
  const cards = read("styles/card-tokens.css");
  assert.match(cards, /--rarity-r:\s*#E8EDF5/);
  assert.match(cards, /--rarity-sr:\s*#C9A8E0/);
  assert.match(cards, /\.yk-rarity-SSR\s*\{[^}]*--card-badge:\s*#FF5FA8/);
  assert.match(cards, /\.yk-rarity-LR\s*\{[^}]*--card-badge-ink:\s*#F6DC8E/);
});

test("pressed primary controls retain the readable pink fill after the generic pressed rule", () => {
  const rules = postcss.parse(read("styles/ui.css")).nodes;
  const generic = rules.findIndex(
    node =>
      node.type === "rule" &&
      node.selectors.includes(".yk-button:active:not(:disabled)")
  );
  const primary = rules.findIndex(
    node =>
      node.type === "rule" &&
      node.selectors.includes(".yk-button-primary:active:not(:disabled)")
  );
  assert.ok(generic >= 0 && primary > generic);
  assert.ok(
    rules[primary].nodes.some(
      node =>
        node.prop === "background" && node.value === "var(--color-focus-ring)"
    )
  );
  assert.ok(
    rules[primary].nodes.some(
      node => node.prop === "color" && node.value === "var(--color-void)"
    )
  );
});
