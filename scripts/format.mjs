import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Only tracked files: never rewrite unknown local work or generated files.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const cli = fileURLToPath(
  new URL("../node_modules/prettier/bin/prettier.cjs", import.meta.url)
);
const result = spawnSync(
  process.execPath,
  [cli, "--ignore-unknown", ...process.argv.slice(2), ...files],
  { stdio: "inherit", windowsHide: true }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
