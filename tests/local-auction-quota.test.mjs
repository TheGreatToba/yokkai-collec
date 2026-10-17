import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = file =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
function evaluate(code, globals = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText,
    { exports: compiled.exports, module: compiled, require, ...globals }
  );
  return compiled.exports;
}
const offer = evaluate(source("lib/premium/offer.ts"));
const quota = evaluate(source("lib/ui/local-auction-quota.ts"), {
  require: id => {
    assert.equal(id, "@/lib/premium/offer");
    return offer;
  }
});
const live = id => ({
  instanceId: "card-" + id,
  auctionId: String(id),
  endsAt: "2099-01-01T00:00:00Z"
});
const tree = ts.createSourceFile(
  "game.tsx",
  source("components/game.tsx"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "auctionCard")
    handler = node;
  ts.forEachChild(node, visit);
}
visit(tree);
function game(limit, listings, overrides = {}) {
  const calls = [],
    updates = [],
    lock = { current: false };
  const api = evaluate("export " + handler.getText(tree), {
    ...quota,
    previewData: undefined,
    auctionLimit: limit,
    auctionSubmitting: lock,
    getActiveAuctionCards: async () => {
      calls.push("read-auctions");
      return listings;
    },
    createAuction: async (...args) => {
      calls.push(args);
    },
    getUserCollection: async () => {
      calls.push("read-collection");
      return [];
    },
    setActiveAuctionCards: items => updates.push(items),
    setCollection() {},
    ...overrides
  });
  return { api, calls, updates, lock };
}

test("local Basic has 3 slots, Pro 6; disabled trial does not change production limits", () => {
  assert.equal(quota.localAuctionLimit("basic"), 3);
  assert.equal(quota.localAuctionLimit("pro"), 6);
  assert.equal(quota.localAuctionLimit(null), null);
  assert.equal(
    quota.countLiveAuctionListings([
      live(1),
      live(1),
      live(2),
      { ...live(3), endsAt: "2000-01-01T00:00:00Z" },
      { ...live(4), endsAt: "invalid" }
    ]),
    3
  );
});

test("listing checks fresh active auctions before creation and blocks the fourth Basic/seventh Pro", async () => {
  for (const limit of [3, 6]) {
    const listings = Array.from({ length: limit }, (_, i) => live(i));
    const fixture = game(limit, listings);
    await assert.rejects(fixture.api.auctionCard("next-card", 10, 60), {
      message: quota.auctionLimitMessage(limit)
    });
    assert.deepEqual(fixture.calls, ["read-auctions"]);
    assert.equal(fixture.updates[0], listings);
    assert.equal(fixture.lock.current, false);
    const available = game(limit, listings.slice(1));
    await available.api.auctionCard("next-card", 10, 60);
    assert.deepEqual(available.calls, [
      "read-auctions",
      ["next-card", 10, 60],
      "read-collection",
      "read-auctions"
    ]);
  }
});

test("failed count reads cannot create listings; the synchronous lock rejects concurrent handlers", async () => {
  let release;
  const fixture = game(3, [], {
    getActiveAuctionCards: () =>
      new Promise(resolve => {
        release = resolve;
      })
  });
  const first = fixture.api.auctionCard("one", 10, 60);
  await assert.rejects(
    fixture.api.auctionCard("two", 10, 60),
    /already being listed/
  );
  release(Array.from({ length: 3 }, (_, i) => live(i)));
  await assert.rejects(first, /up to 3 active auctions/);
  assert.equal(fixture.lock.current, false);
  const failed = game(3, [], {
    getActiveAuctionCards: async () => {
      throw new Error("Unavailable");
    }
  });
  await assert.rejects(failed.api.auctionCard("one", 10, 60), /Unavailable/);
  assert.deepEqual(failed.calls, []);
  assert.equal(failed.lock.current, false);
  const unchanged = game(
    null,
    Array.from({ length: 9 }, (_, i) => live(i))
  );
  await unchanged.api.auctionCard("one", 10, 60);
  assert.deepEqual(unchanged.calls[0], ["one", 10, 60]);
});
