import { readFileSync } from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

function setup(storage = new Map(), locks) {
  let now = 1800000000000;
  const math = Object.create(Math);
  const context = { exports: {}, Math: math, Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }, crypto: { randomUUID }, window: { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } } };
  const source = ts.transpileModule(readFileSync(new URL("../lib/data/cards.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  if (locks) context.navigator = { locks };
  vm.runInNewContext(source, context);
  return { api: context.exports, storage, math, advance: ms => { now += ms; } };
}
test("catalogue, tirage, persistance, tri et plafond", async () => {
  const { api, advance } = setup();
  const cards = await api.getAllCards();
  assert.equal(cards.length, 30);
  assert.equal(new Set(cards.map(c => c.category)).size, 3);
  assert.equal((await api.getPackStatus()).available, 1);
  const draw = await api.openBooster();
  assert.equal(draw.length, 10);
  assert.equal(new Set(draw.map(c => c.instanceId)).size, 10);
  const rank = { C: 0, R: 1, SR: 2, SSR: 3 };
  assert.ok(draw.every((c, i) => !i || rank[draw[i - 1].rarity] <= rank[c.rarity]));
  assert.equal((await api.getUserCollection()).length, 10);
  await assert.rejects(api.openBooster(), /Aucun pack/);
  advance(30 * 60000 - 1);
  assert.equal((await api.getPackStatus()).available, 0);
  advance(1);
  assert.equal((await api.getPackStatus()).available, 1);
  advance(24 * 60 * 60000);
  assert.equal((await api.getPackStatus()).available, 3);
  assert.equal((await api.getPackStatus()).nextPackAt, null);
  await api.openBooster();
  advance(30 * 60000 - 1);
  assert.equal((await api.getPackStatus()).available, 2);
  advance(1);
  assert.equal((await api.getPackStatus()).available, 3);
  const collection = await api.getUserCollection();
  assert.ok(collection.every((c, i) => !i || rank[collection[i - 1].rarity] >= rank[c.rarity]));
});

test("collection et échéance restaurées après rechargement", async () => {
  const first = setup();
  const initial = await first.api.getPackStatus();
  const draw = await first.api.openBooster();
  const reloaded = setup(first.storage);
  assert.equal((await reloaded.api.getPackStatus()).nextPackAt, initial.nextPackAt);
  assert.equal((await reloaded.api.getPackStatus()).available, 0);
  const restored = await reloaded.api.getUserCollection();
  assert.deepEqual(Array.from(restored, c => c.instanceId).sort(), Array.from(draw, c => c.instanceId).sort());
  assert.ok(restored.every(c => c.obtainedAt === draw[0].obtainedAt));
});

test("régénération hors ligne conserve le reliquat et ouvrir ne décale pas le timer", async () => {
  const { api, advance } = setup();
  const initial = await api.getPackStatus();
  await api.openBooster();
  advance(45 * 60000);
  const status = await api.getPackStatus();
  assert.equal(status.available, 1);
  assert.equal(status.nextPackAt, initial.nextPackAt + 30 * 60000);
  await api.openBooster();
  assert.equal((await api.getPackStatus()).nextPackAt, status.nextPackAt);
});

test("un échec de sauvegarde ne consomme ni pack ni cartes", async () => {
  const { api, storage } = setup();
  await api.getPackStatus();
  const previous = storage.get("yokkai-collec-v1");
  storage.set = () => { throw new Error("QuotaExceededError"); };
  await assert.rejects(api.openBooster(), /sauvegarde locale est indisponible/);
  assert.equal(storage.get("yokkai-collec-v1"), previous);
  assert.equal((await api.getUserCollection()).length, 0);
  assert.equal((await api.getPackStatus()).available, 1);
});

test("lectures et ouvertures de deux onglets partagent le verrou", async () => {
  let queue = Promise.resolve();
  const keys = [];
  const locks = { request(key, operation) {
    keys.push(key);
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  } };
  const storage = new Map();
  const first = setup(storage, locks);
  const second = setup(storage, locks);
  const results = await Promise.allSettled([
    first.api.getPackStatus(), second.api.getUserCollection(),
    first.api.openBooster(), second.api.openBooster(),
  ]);
  assert.equal(results[2].status, "fulfilled");
  assert.equal(results[3].status, "rejected");
  assert.match(results[3].reason.message, /Aucun pack/);
  assert.equal(keys.length, 4);
  assert.ok(keys.every(key => key === "yokkai-collec-v1"));
  assert.equal((await second.api.getUserCollection()).length, 10);
});
test("seuils exacts des probabilités et doublons indépendants", async () => {
  for (const [roll, rarity] of [[0, "C"], [.59999, "C"], [.60, "R"], [.84999, "R"], [.85, "SR"], [.94999, "SR"], [.95, "SSR"], [.99999, "SSR"]]) {
    const { api, math } = setup(); math.random = () => roll;
    const draw = await api.openBooster();
    assert.ok(draw.every(c => c.rarity === rarity));
    assert.equal(new Set(draw.map(c => c.id)).size, 1);
    assert.equal(new Set(draw.map(c => c.instanceId)).size, 10);
  }
});
test("sauvegarde corrompue conservée", async () => {
  const { api, storage } = setup();
  storage.set("yokkai-collec-v1", "invalid");
  await assert.rejects(api.getUserCollection(), /illisible/);
  assert.equal(storage.get("yokkai-collec-v1"), "invalid");
});
