import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Launch with npm run ci");

const steps = [
  [npm, "audit", "--omit=dev", "--audit-level=high"],
  [npm, "run", "lint"],
  [require.resolve("typescript/bin/tsc"), "--noEmit"],
  [npm, "run", "format:check"],
  [npm, "test"],
  [npm, "run", "build"],
  ["tests/design-system-production.mjs"],
  ["--test", "tests/migration-security.test.mjs"]
];

for (const args of steps) {
  let env = process.env;
  if (args[2] === "build") {
    // Next's loader preserves shell values and the precedence of local .env files.
    require("@next/env").loadEnvConfig(process.cwd(), false);
    env = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "sb_publishable_ci_dummy",
      NEXT_PUBLIC_SITE_URL:
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid",
      MAINTENANCE_MODE: process.env.MAINTENANCE_MODE ?? "false"
    };
  }
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
