import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const topbar = readFileSync(new URL("../components/topbar.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/topbar.css", import.meta.url), "utf8");

test("la topbar affiche le nouveau logo de marque à gauche", () => {
  assert.match(topbar, /src="\/assets\/yokkai-collec-logo\.png"/);
  assert.match(topbar, /className="yk-brand-logo"/);
  assert.doesNotMatch(topbar, /className="yk-logo">Y/);
  assert.match(css, /\.yk-brand-logo \{[^}]*height: 58px;/);
});
