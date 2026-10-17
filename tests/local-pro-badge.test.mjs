import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const source = path => readFileSync(resolve(root, path), "utf8");

test("badge preview is opt-in and restricted to the owner's local profile", () => {
  const page = source("app/profile/page.tsx");
  const badge = source("components/local-pro-badge-preview.tsx");
  assert.match(page, /return localPremiumEnabled\(\) \?/);
  assert.match(
    page,
    /<LocalProBadgePreview>\{profile\}<\/LocalProBadgePreview>/
  );
  assert.match(badge, /createContext\(false\)/);
  assert.match(badge, /if \(!enabled \|\| !isMe\) return null/);
  assert.match(badge, /aria-label="Yokkai Pro \(local preview\)"/);
  assert.match(badge, /title="Yokkai Pro"/);
  assert.doesNotMatch(badge, /fetch\(|\.rpc\(|localStorage|setItem|stripe/i);
  assert.doesNotMatch(
    source("app/profile/[id]/page.tsx"),
    /LocalProBadgePreview/
  );
});

test("badge is inline next to the name and does not change profile actions", () => {
  const profile = source("components/profile.tsx").replace(/\s+/g, " ");
  assert.match(
    profile,
    /<h2> \{profile.pseudo\} <LocalProProfileBadge isMe=\{isMe\} \/> <\/h2>/
  );
  assert.match(
    source("styles/profile.css"),
    /\.yk-profile-pro-badge \{[^}]*display: inline-flex/
  );
});
