import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("le reveal SR possede un flash bref et un pulse sans reprendre le burst SSR/LR", () => {
  const source = readFileSync(path.join(root, "components/boosters.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(source, /rarity === "SR" && <div className="yk-sr-flash"/);
  assert.match(source, /rarity === "SSR" \|\| current\?\.rarity === "LR"\) && <div className="yk-burst"/);
  assert.match(css, /\.yk-reveal-sr \.yk-face-up \{ animation: yk-sr-border-pulse/);
  assert.match(css, /@keyframes yk-sr-flash/);
});

test("SSR et LR escaladent rayons, particules, shake et duree", () => {
  const source = readFileSync(path.join(root, "components/boosters.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(source, /current\.rarity === "LR" \? 1900 : current\.rarity === "SSR" \? 1100/);
  assert.match(source, /className="yk-reveal-rays"/);
  assert.match(source, /current\.rarity === "LR" \? 22 : 12/);
  assert.match(css, /\.yk-reveal-ssr \{ animation: yk-ssr-shake/);
  assert.match(css, /\.yk-reveal-lr::before/);
  assert.match(css, /transition-delay: \.55s/);
});

test("Shiny garde un chatoiement continu sur la carte", () => {
  const css = readFileSync(path.join(root, "styles/cards.css"), "utf8");
  assert.match(css, /\.yk-shiny\.yk-animated \.yk-card-art::after/);
  assert.match(css, /animation: yk-shiny-glint 3\.2s/);
});
