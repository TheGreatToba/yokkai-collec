import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeWhitespace } from "./helpers/normalize-whitespace.mjs";

const game = readFileSync(
  new URL("../components/game.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../styles/boosters.css", import.meta.url),
  "utf8"
);

test("la révélation remonte les cartes et masque le grand en-tête de page", () => {
  assert.match(game, /yk-game-main/);
  assert.match(game, /yk-pack-page-heading/);
  assert.match(
    css,
    /\.yk-game-main:has\(\.yk-reveal-screen\)[^{]*\{[^}]*padding-top:/
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/> \.yk-pack-page-heading \{ display: none; \}/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-reveal-screen \{ margin-top: 0; \}/)
  );
});
