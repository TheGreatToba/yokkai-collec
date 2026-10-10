import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup(offers, { failCards = false } = {}) {
  const requests = [];
  const client = {
    auth: { onAuthStateChange() {} },
    async rpc(name) {
      assert.equal(name, "list_trade_offers");
      requests.push({ rpc: name });
      return { data: offers, error: null };
    },
    from(table) {
      assert.equal(table, "cards");
      return { select(fields) {
        assert.equal(fields, "id,franchise");
        return { async in(column, ids) {
          assert.equal(column, "id");
          requests.push({ ids: [...ids] });
          assert.ok(ids.length <= 200, "gateway URL limit");
          return { data: ids.map(id => ({ id, franchise: `Live ${id}` })),
            error: failCards ? { code: "42501" } : null };
        } };
      } };
    },
  };
  let cards;
  const require = name => {
    if (name === "@/utils/supabase/client") return { createClient: () => client };
    if (name === "@/lib/data/cards") return cards;
    if (name === "@/lib/ui/card-search") return {};
    if (name === "@/lib/data/player-state") return {
      createPlayerSnapshotCache: () => ({}), subscribePlayerSnapshotInvalidation() {},
    };
    assert.fail(`Unexpected import: ${name}`);
  };
  function load(path) {
    const context = { exports: {}, require };
    const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(source, context);
    return context.exports;
  }
  cards = load("../lib/data/cards.ts");
  return { api: load("../lib/data/trades.ts"), requests };
}

const copy = (id, instanceId) => ({ id, instanceId, name: id, anime: "stale",
  image: `custom-${instanceId}`, customImageUrl: `custom-${instanceId}`, locked: true });

test("trade history batches live franchises once without changing offers or copies", async t => {
  const measured = [];
  for (const count of [1, 10, 100]) {
    const offers = Array.from({ length: count }, (_, i) => ({ id: `offer-${i}`, status: "pending",
      offeredCards: [copy("same", `give-${i}`)], requestedCards: [copy("same", `take-${i}`)] }));
    const before = JSON.stringify(offers);
    const { api, requests } = setup(offers);
    const result = await api.listTradeOffers();
    t.diagnostic(`${count} offers: ${requests.length} requests (1 RPC + ${requests.filter(r => r.ids).length} cards)`);
    measured.push(requests.length);
    assert.equal(JSON.stringify(offers), before, "input must not be mutated");
    assert.deepEqual(JSON.parse(JSON.stringify(result)), offers.map(offer => ({ ...offer,
      offeredCards: offer.offeredCards.map(card => ({ ...card, anime: "Live same" })),
      requestedCards: offer.requestedCards.map(card => ({ ...card, anime: "Live same" })) })));
  }
  assert.deepEqual(measured, [2, 2, 2], "shared catalogue id must be fetched once across all offers");
});

test("trade batching keeps gateway batches bounded and handles empty lots and read failures", async () => {
  const offers = [{ id: "empty", offeredCards: [], requestedCards: [] },
    { id: "large", offeredCards: Array.from({ length: 451 }, (_, i) => copy(`card-${i}`, `copy-${i}`)), requestedCards: [] }];
  const { api, requests } = setup(offers);
  assert.equal((await api.listTradeOffers())[1].offeredCards.length, 451);
  assert.equal(requests.length, 4, "1 RPC + 3 bounded catalogue batches");
  assert.deepEqual((await setup([]).api.listTradeOffers()).length, 0);
  await assert.rejects(setup(offers, { failCards: true }).api.listTradeOffers(), /inaccessibles/);
});
