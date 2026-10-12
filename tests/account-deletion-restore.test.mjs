import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOptions,
  validateJournal,
  exportJournal,
  reapplyJournal
} from "../scripts/reapply-account-deletions.mjs";
const id = "10000000-0000-4000-8000-000000000001",
  url = "https://example.test";
const entry = { user_id: id, deleted_at: "2026-10-11T10:00:00Z" };
const journal = {
  version: 1,
  project_url: url,
  exported_at: "2026-10-11T11:00:00Z",
  deletions: [entry]
};
test("restoration defaults to dry-run and refuses ambiguous or bypass flags", () => {
  assert.deepEqual(parseOptions(["--journal", "private.json"]), {
    apply: false,
    journal: "private.json"
  });
  assert.deepEqual(parseOptions(["--journal", "private.json", "--apply"]), {
    apply: true,
    journal: "private.json"
  });
  for (const args of [
    [],
    ["--apply"],
    ["--journal"],
    ["--export", "a", "--apply"],
    ["--journal", "a", "--export", "b"],
    ["--journal", "a", "--yes"]
  ])
    assert.throws(() => parseOptions(args));
});
test("journal binds target and rejects invalid, duplicate, future or excess personal fields", () => {
  assert.deepEqual(validateJournal(journal, url), [entry]);
  for (const bad of [
    { ...journal, project_url: "https://wrong.test" },
    { ...journal, exported_at: "bad" },
    { ...journal, deletions: [entry, entry] },
    { ...journal, deletions: [{ ...entry, email: "private" }] },
    { ...journal, deletions: [{ ...entry, user_id: "bad" }] },
    {
      ...journal,
      deletions: [{ ...entry, deleted_at: "2027-01-01T00:00:00Z" }]
    }
  ])
    assert.throws(() => validateJournal(bad, url));
});
test("export reads only UUID/date and keyset-paginates beyond 1000 entries", async () => {
  const entries = Array.from({ length: 1001 }, (_, i) => ({
    ...entry,
    user_id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`
  }));
  let reads = 0;
  const admin = {
    from: table => {
      assert.equal(table, "account_deletion_log");
      const q = {
        select: columns => {
          assert.equal(columns, "user_id,deleted_at");
          return q;
        },
        order: column => {
          assert.equal(column, "user_id");
          return q;
        },
        limit: n => {
          assert.equal(n, 1000);
          return q;
        },
        gt: (column, last) => {
          assert.equal(column, "user_id");
          assert.equal(last, entries[999].user_id);
          return q;
        },
        then: resolve =>
          resolve({
            data: reads++ === 0 ? entries.slice(0, 1000) : entries.slice(1000),
            error: null
          })
      };
      return q;
    }
  };
  assert.equal((await exportJournal(admin, url)).deletions.length, 1001);
  assert.equal(reads, 2);
});
test("reapplication uses shared ordered cleanup, hard Auth deletion, and stops without retry", async () => {
  const calls = [];
  const admin = {
    rpc: async name => {
      calls.push(name);
      return { data: [], error: null };
    },
    storage: {
      from: () => {
        assert.fail("empty manifest");
      }
    },
    auth: {
      admin: {
        deleteUser: async (uuid, soft) => {
          calls.push([uuid, soft]);
          return { error: { code: "user_not_found" } };
        }
      }
    }
  };
  await reapplyJournal(admin, [entry]);
  assert.deepEqual(calls, [
    "begin_account_deletion",
    "prepare_account_deletion",
    [id, false]
  ]);
  let attempts = 0;
  admin.rpc = async () => {
    attempts++;
    return { error: { message: "SECRET_PROVIDER_DETAIL" } };
  };
  await assert.rejects(
    reapplyJournal(admin, [entry, entry]),
    error =>
      error.message.includes("REAPPLICATION_STOPPED") &&
      !error.message.includes("SECRET")
  );
  assert.equal(attempts, 1);
});
