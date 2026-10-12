import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
test("deployment pins the same Node major as verification and explicit npm phases", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url))
  );
  const lock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url))
  );
  assert.equal(pkg.engines?.node, "22.x");
  assert.deepEqual(lock.packages[""].engines, pkg.engines);
  const config = readFileSync(
    new URL("../nixpacks.toml", import.meta.url),
    "utf8"
  );
  assert.match(config, /NIXPACKS_NODE_VERSION\s*=\s*"22"/);
  assert.match(
    config,
    /\[phases\.install\][\s\S]*?cmds\s*=\s*\["npm ci --include=dev"\]/
  );
  assert.match(
    config,
    /\[phases\.build\][\s\S]*?cmds\s*=\s*\["npm run build"\]/
  );
  assert.match(config, /\[start\][\s\S]*?cmd\s*=\s*"npm run start"/);
});
