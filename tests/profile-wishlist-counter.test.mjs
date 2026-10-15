import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("current profile has one private-aware wishlist entry point and no view recorder", () => {
  const source = readFileSync(
    new URL("../components/profile.tsx", import.meta.url),
    "utf8"
  );
  const api = readFileSync(
    new URL("../lib/data/profile.ts", import.meta.url),
    "utf8"
  );
  const preview = readFileSync(
    new URL("../components/profile-preview.tsx", import.meta.url),
    "utf8"
  );
  for (const code of [source, api, preview]) {
    assert.doesNotMatch(
      code,
      /recordProfileView|record_profile_view|recordView|visitIds|countedVisits/
    );
  }
  assert.doesNotMatch(source, /data-profile-views|Vues du profil/);
  assert.doesNotMatch(
    source,
    /\["wishlist", "Wishlist"\]|tab !== "wishlist"|wishlistLimit/
  );
  assert.equal(source.match(/data-profile-wishlist/g)?.length, 1);
  assert.match(
    source,
    /<button[\s\S]*?onClick=\{\(\) => setWishlistOpen\(true\)\}[\s\S]*?disabled=\{!profile.canViewCollection\}[\s\S]*?data-profile-wishlist[\s\S]*?aria-haspopup="dialog"/
  );
  assert.match(source, /open=\{wishlistOpen && profile.canViewCollection\}/);
  assert.match(source, /title=\{`Wishlist de \$\{profile.pseudo\}`\}/);
  assert.match(source, /<FriendWishlist\s+cards=\{wishlist\}/);
  assert.match(
    source,
    /profile.canViewCollection \? wishlist.length : "Privée"/
  );
  assert.match(source, /data-profile-likes/);
  assert.match(
    api,
    /export type ProfileEngagement = \{likes:number;likedByMe:boolean\}/
  );
  assert.match(source, /adapter.engagement\(profileId\)/);
});
