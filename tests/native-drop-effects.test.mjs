import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("styles/boosters-native.css");
const reveal = read("components/boosters.tsx");

test("drops animate the real card with native CSS, without a video or skip player", () => {
  assert.match(
    read("app/layout.tsx"),
    /import "\.\.\/styles\/boosters-native\.css"/
  );
  assert.match(reveal, /faceUp && <YokaiCard \{\.\.\.current\} \/>/);
  assert.doesNotMatch(
    reveal,
    /<video|CardDropCinematic|Skip animation|\/assets\/drops/
  );
  assert.doesNotMatch(css, /\.mp4|\.webm|mask-composite/);
  assert.equal(
    existsSync(
      new URL("../components/card-drop-cinematic.tsx", import.meta.url)
    ),
    false
  );
});

test("SR uses violet ignition and a star/halo composition", () => {
  assert.match(css, /--drop-violet: #c4a3ee/);
  assert.match(
    css,
    /\.yk-reveal-sr \.yk-sr-flash[^}]*background: radial-gradient\(ellipse, #c4a3ee44/
  );
  assert.match(css, /@keyframes yk-native-sr-halo/);
  assert.match(css, /@keyframes yk-native-stars/);
  assert.match(css, /@keyframes yk-native-sr-ring/);
});

test("SSR flips the real card in pink comet ribbons and petals", () => {
  assert.match(css, /animation: yk-native-ssr-flip 3\.2s/);
  assert.match(css, /@keyframes yk-native-ssr-flip/);
  assert.match(css, /@keyframes yk-native-pink-comet/);
  assert.match(css, /\.yk-ssr-ribbon-stage/);
  assert.match(css, /\.yk-ssr-petal/);
  assert.match(css, /stroke-dasharray: 90 48 24 438/);
});

test("LR retains the anticipation, then a native golden starburst", () => {
  assert.match(css, /animation: yk-native-lr-flip 4\.4s/);
  assert.match(css, /@keyframes yk-native-lr-flip/);
  assert.match(css, /@keyframes yk-native-golden-burst/);
  assert.match(css, /clip-path: polygon\(0 48%, 100% 0, 100% 100%, 0 52%\)/);
  assert.match(css, /\.yk-lr-cosmic-dust/);
  assert.match(css, /#e8c26a/);
});

test("mobile and reduced motion remain supported without changing the server result or reveal timing", () => {
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /transition: none !important/);
  assert.match(
    reveal,
    /isLR \? 4400 : isSSR \? 3200 : current\.rarity === "SR" \? 520 : 0/
  );
  assert.match(
    reveal,
    /if \(faceUp\) \{ if \(!revealLocked\) deposit\(\); return; \}/
  );
  assert.match(reveal, /setSpot\(current\)/);
});
