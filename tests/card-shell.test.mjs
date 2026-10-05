import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("CI negative probe", () => assert.equal(true, false));

const root = path.resolve(import.meta.dirname, "..");

test("le shell conserve le ratio 5:7 et ne modifie pas la face", () => {
  const card = readFileSync(path.join(root, "components/yokai-card.tsx"), "utf8");
  const shell = readFileSync(path.join(root, "components/card-shell.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/card-shell.css"), "utf8");
  assert.match(css, /\.yk-card-shell[^}]*aspect-ratio:\s*5 \/ 7/s);
  assert.match(shell, /\{children\}<span className="yk-card-shell-reflection"/);
  assert.match(card, /className={`yk-card yk-rarity-/);
});

test("le tilt ne rerend pas React et anime seulement transform et opacite", () => {
  const shell = readFileSync(path.join(root, "components/card-shell.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/card-shell.css"), "utf8");
  assert.doesNotMatch(shell, /useState|setState/);
  assert.match(shell, /requestAnimationFrame/);
  assert.match(shell, /addEventListener\("pointermove"/);
  assert.match(css, /will-change:\s*transform;/);
  assert.match(css, /will-change:\s*transform,opacity;/);
  assert.doesNotMatch(css, /transition:[^;]*(?:top|left|width|height|background-position)/);
});

test("le shell interactif est neutralise pour tactile et mouvement reduit", () => {
  const shell = readFileSync(path.join(root, "components/card-shell.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/card-shell.css"), "utf8");
  assert.match(shell, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(shell, /event\.pointerType === "touch"/);
  assert.match(shell, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\), \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /--shell-reflect-opacity:\s*0 !important/);
});

test("les reveals et la confirmation Decision Pack gardent les composants directs", () => {
  const boosters = readFileSync(path.join(root, "components/boosters.tsx"), "utf8");
  assert.doesNotMatch(boosters, /CardShell/);
  assert.match(boosters, /<span className="yk-flip-back"[^>]*><CardBack \/><\/span><span className="yk-flip-front"[^>]*>\{faceUp && <YokaiCard \{\.\.\.current\} \/>\}/);
  assert.match(boosters, /title={`Garder \$\{chosen\?\.name \|\| "cette carte"\} \?`}[^]*?<YokaiCard \{\.\.\.chosen\} \/>/);
});
