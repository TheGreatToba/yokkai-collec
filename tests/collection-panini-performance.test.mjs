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
const profile = readFileSync(
  new URL("../components/profile.tsx", import.meta.url),
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

test("le bouton Classeur revient à la collection normale au second clic", () => {
  assert.match(collection, /<span>Classeur<\/span>/);
  assert.match(collection, /<h2>Mes classeurs par licence<\/h2>/);
  assert.doesNotMatch(
    collection,
    /Album Panini|Mode Panini|Mes albums par licence|Tous les albums|Chargement des albums/
  );
  assert.match(
    collection,
    /setViewMode\(current =>\s*current === "panini" \? "grid" : "panini"\s*\)/
  );
});

test("la collection d'un ami reçoit ses propres chargeurs Panini", () => {
  assert.match(profile, /getFriendPaniniAlbumsPage\(profile\.id, options\)/);
  assert.match(
    profile,
    /getFriendPaniniAlbumCardsPage\(profile\.id, options\)/
  );
  assert.match(
    profile,
    /loadPaniniAlbums=\{loadFriendPaniniAlbums\}[^]*loadPaniniAlbumCards=\{loadFriendPaniniAlbumCards\}[^]*readOnly/
  );
});
