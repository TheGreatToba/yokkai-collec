import assert from "node:assert/strict";
import test from "node:test";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync
} from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dockerWarning } from "../scripts/verify.mjs";

const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("verify is unique, preserves all gates and builds only with dummy public configuration", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.verify, "node scripts/verify.mjs");
  assert.equal(pkg.scripts["verify:quick"], "node scripts/ci.mjs --quick");
  const ci = read("scripts/ci.mjs");
  for (const gate of [
    "--audit-level=high",
    "--noEmit",
    "format:check",
    "design-system-production.mjs",
    "migration-security.test.mjs",
    "next/dist/bin/next"
  ])
    assert.ok(ci.includes(gate), gate);
  assert.ok(ci.includes('git", ["ls-files'));
  assert.ok(
    ci.includes(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_ci_dummy"'
    ) ||
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:\s*"sb_publishable_ci_dummy"/.test(
        ci
      )
  );
  assert.match(read("scripts/verify.mjs"), /merge-base[\s\S]*--is-ancestor/);
  assert.match(read("scripts/verify.mjs"), /VERIFY ECHEC/);
  assert.match(read("scripts/ci-db.mjs"), /Docker distant refusé/);
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /pull_request:\s*\n\s*branches: \[master\]/);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(
    workflow,
    /types: \[opened, synchronize, reopened, ready_for_review\]/
  );
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.match(
    workflow,
    /if: github\.event_name == 'workflow_dispatch' \|\| github\.event\.pull_request\.draft == false/
  );
  for (const file of ["AGENTS.md", "CLAUDE.md"])
    assert.match(read(file), /npm run verify[\s\S]*juste avant le merge/);
});

test("Docker absent or unreachable is an explicit warning, never a silent SQL success", () => {
  assert.equal(dockerWarning({ status: 0 }), null);
  for (const result of [
    { status: 1 },
    { status: null, error: { code: "ENOENT" } },
    { status: null, error: { code: "ETIMEDOUT" } }
  ])
    assert.match(
      dockerWarning(result),
      /AVERTISSEMENT[\s\S]*PostgreSQL 17 et concurrence NON EXECUTES/
    );
});

test("real pre-push rejects master before checks and propagates a failing fast check", () => {
  const bash =
    process.platform === "win32"
      ? "C:\\Program Files\\Git\\bin\\bash.exe"
      : "/bin/sh";
  const dir = mkdtempSync(join(tmpdir(), "yokkai-prepush-"));
  assert.ok(
    resolve(dir).startsWith(join(resolve(tmpdir()), "yokkai-prepush-"))
  );
  try {
    execFileSync("git", ["init", "-q", dir]);
    const bin = join(dir, "bin"),
      log = join(dir, "ran");
    mkdirSync(bin);
    writeFileSync(
      join(bin, "npm"),
      '#!/bin/sh\nprintf "%s\\n" "$*" > ran\ntest -z "${GIT_DIR-}${GIT_WORK_TREE-}${GIT_INDEX_FILE-}" || exit 19\nexit 17\n',
      { mode: 0o755 }
    );
    const hook = fileURLToPath(
      new URL("../.githooks/pre-push", import.meta.url)
    );
    const env = {
      ...process.env,
      PATH: bin + delimiter + process.env.PATH,
      GIT_DIR: join(dir, ".git"),
      GIT_WORK_TREE: dir,
      GIT_INDEX_FILE: join(dir, ".git", "index")
    };
    const master = spawnSync(bash, [hook], {
      cwd: dir,
      env,
      input: "refs/heads/master a refs/heads/master b\n",
      encoding: "utf8"
    });
    assert.equal(master.status, 1, master.stderr);
    assert.equal(existsSync(log), false);
    const branch = spawnSync(bash, [hook], {
      cwd: dir,
      env,
      input: "refs/heads/wz/test a refs/heads/wz/test b\n",
      encoding: "utf8"
    });
    assert.equal(branch.status, 17, branch.stderr);
    assert.equal(readFileSync(log, "utf8").trim(), "run verify:quick");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
