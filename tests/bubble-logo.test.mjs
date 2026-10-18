import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("chrome logo preserves the supplied PNG dimensions", () => {
  const png = readFileSync("public/assets/brand-logo-chrome.png");
  assert.deepEqual(
    png.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  assert.equal(png.readUInt32BE(16), 1672);
  assert.equal(png.readUInt32BE(20), 941);
});

for (const file of [
  "components/topbar.tsx",
  "app/page.tsx",
  "app/(auth)/layout.tsx",
  "app/reset-password/page.tsx"
]) {
  test(`${file} renders the chrome logo without changing its aspect ratio`, () => {
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /src="\/assets\/brand-logo-chrome\.png"\s+alt=""\s+width=\{1672\}\s+height=\{941\}/
    );
  });
}
