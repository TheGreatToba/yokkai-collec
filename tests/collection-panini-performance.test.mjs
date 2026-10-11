import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(
  new URL("../components/game.tsx", import.meta.url),
  "utf8"
);
const collection = readFileSync(
  new URL("../components/collection.tsx", import.meta.url),
  "utf8"
);

test("la collection normale ne télécharge plus le catalogue complet", () => {
  assert.doesNotMatch(game, /getAllCards/);
  assert.doesNotMatch(game, /getLicenseCatalogueTotals/);
  assert.match(game, /loadPaniniAlbums=\{getPaniniAlbumsPage\}/);
  assert.match(game, /loadPaniniAlbumCards=\{getPaniniAlbumCardsPage\}/);
});

test("les données Panini ne sont chargées que lorsque ce mode est ouvert", () => {
  assert.match(
    collection,
    /if \(viewMode !== "panini" \|\| selectedLicense \|\| !loadPaniniAlbums\)/
  );
  assert.match(
    collection,
    /if \(viewMode !== "panini" \|\| !selectedLicense \|\| !loadPaniniAlbumCards\)/
  );
});
