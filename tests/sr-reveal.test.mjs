import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("le reveal SR possede un flash bref et un pulse sans reprendre le burst SSR/LR", () => {
  const source = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(source, /rarity === "SR" && <div className="yk-sr-flash"/);
  assert.doesNotMatch(
    source,
    /rarity === "SR"[^\n]*yk-(?:ssr|lr)-cinematic-stage/
  );
  assert.match(
    css,
    /\.yk-reveal-sr \.yk-face-up \{ animation: yk-sr-border-pulse/
  );
  assert.match(css, /@keyframes yk-sr-flash/);
});

test("SSR et LR escaladent rayons, particules, shake et duree", () => {
  const source = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(source, /isLR \? 4400 : isSSR \? 3200/);
  assert.match(source, /className="yk-ssr-cinematic-stage"/);
  assert.match(source, /className="yk-lr-cinematic-stage"/);
  assert.match(source, /className="yk-ssr-godray"/);
  assert.match(source, /className="yk-lr-godray"/);
  assert.match(source, /Array\.from\(\{ length: 36 \}/);
  assert.match(source, /Array\.from\(\{ length: 48 \}/);
  assert.match(
    css,
    /\.yk-reveal-ssr \.yk-deck \{ animation: yk-ssr-deck-charge 3\.2s/
  );
  assert.match(
    css,
    /\.yk-reveal-lr \.yk-deck \{ animation: yk-lr-deck-charge 4\.4s/
  );
  assert.match(css, /\.yk-ssr-cinematic-stage[^}]*pointer-events: none/);
  assert.match(css, /\.yk-lr-cinematic-stage[^}]*pointer-events: none/);
  assert.match(
    css,
    /prefers-reduced-motion:[^}]+[\s\S]*\.yk-ssr-cinematic-stage,\.yk-lr-cinematic-stage[^}]+display: none/
  );
});

test("Shiny garde un chatoiement continu sur la carte", () => {
  const css = readFileSync(path.join(root, "styles/cards.css"), "utf8");
  assert.match(css, /\.yk-shiny\.yk-animated \.yk-card-art::after/);
  assert.match(css, /animation: yk-shiny-glint 3\.2s/);
});
