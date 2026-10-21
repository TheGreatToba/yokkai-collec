import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Pro contains decorative horizontal overflow without introducing a vertical scroll container", () => {
  const css = readFileSync("styles/premium.css", "utf8");
  const page = css.match(/\.yk-premium-page\s*\{([^}]+)\}/)?.[1];
  assert.ok(page);
  assert.match(page, /overflow-x:\s*clip;/);
  assert.doesNotMatch(page, /overflow(?:-y)?:\s*(?:hidden|scroll|auto)/);
  const source = readFileSync("app/premium/page.tsx", "utf8");
  assert.match(source, /className="yk-premium-page"/);
  assert.match(source, /brand-logo-blue\.png/);
});
