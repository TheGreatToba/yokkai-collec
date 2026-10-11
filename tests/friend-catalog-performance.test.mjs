import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("la collection d'un ami charge des images adaptées à la grille", () => {
  const collection = read("../components/collection.tsx");
  const profile = read("../components/profile.tsx");

  assert.match(collection, /COLLECTION_CARD_IMAGE_SIZES/);
  assert.match(profile, /PROFILE_CARD_IMAGE_SIZES/);
  assert.doesNotMatch(collection, /imageSizes="100vw"/);
  assert.doesNotMatch(profile, /imageSizes="100vw"/);
  assert.match(collection, /animated=\{!readOnly\}/);
});

test("la collection d'un ami ne relit pas les licences déjà renvoyées par le RPC", () => {
  const profileData = read("../lib/data/profile.ts");
  const implementation = profileData.match(
    /export async function getFriendCollection[\s\S]*?\nexport async function saveProfile/
  )?.[0];

  assert.ok(implementation);
  assert.match(implementation, /readRequest/);
  assert.doesNotMatch(implementation, /withLiveCardFranchises/);
});
