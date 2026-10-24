import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function setup(error = null) {
  const calls = [],
    writes = [];
  const client = {
    auth: {
      onAuthStateChange: () => {},
      getSession: async () => ({
        data: { session: { user: { id: "fixture-player" } } },
        error: null
      })
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error };
    },
    from: table => ({
      insert: async data => {
        writes.push({ table, data });
        return { error: null };
      },
      delete: () => {
        const where = {};
        const request = {
          eq: (key, value) => {
            where[key] = value;
            return request;
          },
          then: resolve => {
            writes.push({ table, where });
            return resolve({ error: null });
          }
        };
        return request;
      }
    })
  };
  const api = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../lib/data/cards.ts", import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022
        }
      }
    ).outputText,
    {
      exports: api,
      Map,
      Set,
      Promise,
      require: name =>
        ({
          "@/utils/supabase/client": { createClient: () => client },
          "@/lib/data/read-request": {},
          "@/lib/ui/card-search": {},
          "@/lib/data/player-state": {
            createPlayerSnapshotCache: () => ({}),
            subscribePlayerSnapshotInvalidation: () => {}
          }
        })[name]
    }
  );
  return { api, calls, writes };
}

test("favorite actions use the owner-scoped desired-state RPC", async () => {
  const h = setup();
  await h.api.setPaniniAlbumFavorite("  Global Fixture  ", false);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [
    {
      name: "set_global_binder_favorite",
      args: { p_license: "Global Fixture", p_favorite: false }
    }
  ]);
  assert.equal(h.writes.length, 0);
});

test("only an absent RPC permits the legacy pre-migration fallback", async () => {
  const old = setup({ code: "PGRST202" });
  await old.api.setPaniniAlbumFavorite("Source Fixture", true);
  await old.api.setPaniniAlbumFavorite("Source Fixture", false);
  assert.equal(old.writes.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(old.writes[1].where)), {
    user_id: "fixture-player",
    license: "Source Fixture"
  });
  const denied = setup({ code: "42501" });
  await assert.rejects(
    denied.api.setPaniniAlbumFavorite("Source Fixture", false)
  );
  assert.equal(denied.writes.length, 0);
});
