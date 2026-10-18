import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("la direction artistique globale conserve un fond fixe et le logo chrome", () => {
  const globals = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  const topbar = readFileSync(path.join(root, "styles/topbar.css"), "utf8");
  const component = readFileSync(
    path.join(root, "components/topbar.tsx"),
    "utf8"
  );
  assert.match(globals, /body\s*\{[^}]*background-color:/s);
  assert.match(globals, /body\s*\{[^}]*background-image:/s);
  assert.match(globals, /background-attachment:\s*fixed/);
  assert.match(component, /src="\/assets\/brand-logo-chrome\.png"/);
  assert.match(topbar, /backdrop-filter:\s*blur\(10px\) saturate\(118%\)/);
  assert.match(topbar, /background:\s*#fff/);
});

test("le fond reste stable sur mobile et avec les animations réduites", () => {
  const globals = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  assert.match(
    globals,
    /@media \(max-width: 760px\), \(prefers-reduced-motion: reduce\)/
  );
  assert.match(globals, /background-attachment:\s*scroll/);
});
