import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const card = (n, rarity = "C") => ({ id: String(n).padStart(6, "0"), nom: `Carte ${n}`,
  categorie: "Anime/Manga", rarete_base: rarity, image_url: "https://storage.example/image.png" });
const owned = (n, user = "alice", rarity = "C") => ({ id: String(n).padStart(6, "0"),
  user_id: user, date_obtention: new Date(1800000000000 + n * 1000).toISOString(), rarity,
  is_shiny: false, is_evolved: false, is_first_owner: rarity === "LR", folder_id: null, custom_image_url: null, cards: card(n % 3, rarity) });

function setup({ catalogue = [], collection = [], apiLimit = 500 } = {}) {
  let now = 1800000000000;
  let user = "alice";
  let listener;
  let rpcError;
  let queryError;
  let rpcHook;
  const calls = [];
  const client = {
    auth: {
      getClaims: async () => ({ data: user ? { claims: { sub: user } } : null, error: null }),
      onAuthStateChange: (fn) => { listener = fn; },
    },
    from(table) {
      let after = "";
      let selectedUser;
      let limit;
      const query = {
        select: () => query,
        order: (column) => { assert.equal(column, "id"); return query; },
        limit: (value) => { limit = value; return query; },
        gt: (column, value) => { assert.equal(column, "id"); after = value; return query; },
        eq: (column, value) => { assert.equal(column, "user_id"); selectedUser = value; return query; },
        then(resolve) {
          calls.push({ table, after, selectedUser });
          const data = (table === "cards" ? catalogue : collection.filter((c) => c.user_id === selectedUser))
            .filter((c) => c.id > after).sort((a, b) => a.id.localeCompare(b.id)).slice(0, Math.min(limit, apiLimit));
          return Promise.resolve({ data, error: queryError }).then(resolve);
        },
      };
      return query;
    },
    async rpc(name, args) {
      if (name !== "evolve_ssr_card") assert.equal(args, undefined); // Draw parameters remain server-owned.
      calls.push({ rpc: name });
      await rpcHook?.();
      if (rpcError) return { data: null, error: rpcError };
      if (name === "get_game_info") return { data: { user: { id: user, name: user },
        categories: ["Anime/Manga"], rarities: ["C", "R", "SR", "SSR", "LR"],
        dropRates: [{ rarity: "C", percent: 59 }, { rarity: "R", percent: 25 }, { rarity: "SR", percent: 10 }, { rarity: "SSR", percent: 5 }, { rarity: "LR", percent: 1 }], shinyRate: 5, karasBalance: 0 }, error: null };
      if (name === "get_regular_pack_status") return { data: { available: 1, maximum: 5,
        serverNow: 1000000, nextPackAt: 1000000 + 60000 }, error: null };
      if (name === "open_regular_pack") {
        const copies = [owned(901, user, "SSR"), owned(902, user, "C")];
        collection.push(...copies);
        return { data: copies.map((row) => ({ id: row.cards.id, name: row.cards.nom,
          category: row.cards.categorie, rarity: row.cards.rarete_base, image: row.cards.image_url,
          instanceId: row.id, obtainedAt: row.date_obtention, shiny: row.is_shiny, isEvolved: row.is_evolved,
          isFirstOwner: row.is_first_owner, folderId: row.folder_id })), error: null };
      }
      assert.fail(name);
    },
  };
  const context = { exports: {}, Date: class extends Date { static now() { return now; } },
    window: { get localStorage() { assert.fail("Must not access v0.1 localStorage"); } },
    require: (name) => { assert.equal(name, "@/utils/supabase/client"); return { createClient: () => client }; },
  };
  const source = ts.transpileModule(readFileSync(new URL("../lib/data/cards.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, context);
  return { api: context.exports, calls, advance: (ms) => { now += ms; },
    setUser: (id) => { user = id; listener?.("SIGNED_IN", id ? { user: { id } } : null); },
    rpcError: (error) => { rpcError = error; }, queryError: (error) => { queryError = error; },
    duringRpc: (hook) => { rpcHook = hook; } };
}

test("catalogue paginé au-delà de la limite API, mapping et LR conservés", async () => {
  const { api, calls } = setup({ catalogue: Array.from({ length: 1201 }, (_, i) => card(i, i === 0 ? "LR" : "C")), apiLimit: 137 });
  const all = await api.getAllCards();
  assert.equal(all.length, 1201);
  assert.equal(new Set(all.map((c) => c.id)).size, 1201);
  assert.equal(all[0].rarity, "LR");
  assert.equal(all[0].name, "Carte 0");
  assert.equal(all[0].image, "https://storage.example/image.png");
  assert.ok(calls.length > 3);
});

test("collection : pagination, filtre utilisateur, doublons et tri rareté/date", async () => {
  const { api, calls } = setup({ apiLimit: 2, collection: [owned(1), owned(2, "alice", "SSR"),
    owned(3), owned(4), owned(5, "bob", "LR")] });
  const all = await api.getUserCollection();
  assert.equal(all.length, 4);
  assert.equal(all[0].rarity, "SSR");
  assert.deepEqual(Array.from(all, (c) => c.instanceId), ["000002", "000004", "000003", "000001"]);
  assert.equal(all[1].id, all[3].id);
  assert.equal(all[0].catalogueImage, "https://storage.example/image.png");
  assert.ok(calls.every((c) => c.selectedUser === "alice"));
  all[0].name = "changed";
  assert.notEqual((await api.getUserCollection())[0].name, "changed");
  assert.equal(calls.length, 3); // Shared memory cache avoids polling all pages.
});

test("cache court, expiration et aucune réutilisation entre comptes", async () => {
  const { api, calls, advance, setUser } = setup({ collection: [owned(1), owned(2, "bob")] });
  const [first, second] = await Promise.all([api.getUserCollection(), api.getUserCollection()]);
  assert.equal(first[0].instanceId, second[0].instanceId);
  assert.equal(calls.length, 2);
  advance(10001);
  await api.getUserCollection();
  assert.equal(calls.length, 4);
  setUser("bob");
  assert.equal((await api.getUserCollection())[0].instanceId, "000002");
  setUser(null);
  await assert.rejects(api.getUserCollection(), /Connectez-vous/);
});

test("infos réelles, taux inchangés et copies défensives", async () => {
  const { api, calls } = setup();
  const info = await api.getGameInfo();
  assert.equal(info.user.id, "alice");
  assert.deepEqual(Array.from(info.dropRates, (r) => r.percent), [59, 25, 10, 5, 1]);
  assert.equal(info.shinyRate, 5);
  assert.equal(info.karasBalance, 0);
  info.user.name = "mutated";
  info.categories.push("fake");
  assert.equal((await api.getGameInfo()).user.name, "alice");
  assert.equal((await api.getGameInfo()).categories.length, 1);
  assert.equal(calls.length, 1);
});

test("une réponse en vol est rejetée si le compte change pendant la requête", async () => {
  const { api, setUser, duringRpc } = setup();
  duringRpc(() => setUser("bob"));
  await assert.rejects(api.getGameInfo(), /Connectez-vous/);
  duringRpc(undefined);
  assert.equal((await api.getGameInfo()).user.id, "bob");
});

test("le statut vient du serveur même quand l'horloge locale change", async () => {
  const { api, advance } = setup();
  const first = await api.getPackStatus();
  assert.equal(first.nextPackAt, 1800000060000);
  advance(24 * 60 * 60000);
  const second = await api.getPackStatus();
  assert.equal(second.available, 1);
  assert.equal(second.maximum, 5);
  assert.equal(second.nextPackAt - first.nextPackAt, 24 * 60 * 60000);
});

test("ouverture : une RPC, tri du reveal et invalidation immédiate de la collection", async () => {
  const { api, calls } = setup();
  assert.equal((await api.getUserCollection()).length, 0);
  const draw = await api.openBooster();
  assert.deepEqual(Array.from(draw, (c) => c.rarity), ["C", "SSR"]);
  assert.equal((await api.getUserCollection()).length, 2);
  assert.equal(calls.filter((c) => c.rpc === "open_regular_pack").length, 1);
});

test("erreurs DB explicites, requêtes réessayables et aucune relance automatique d'ouverture", async () => {
  const { api, calls, rpcError, queryError } = setup();
  for (const [message, expected] of [["PACK_NOT_READY", /Aucun pack/], ["PROFILE_MISSING", /profil/],
    ["CATALOGUE_INCOMPLETE", /catalogue/], ["secret internals", /Impossible/]]) {
    rpcError({ message });
    await assert.rejects(api.openBooster(), expected);
  }
  assert.equal(calls.length, 4);
  queryError({ message: "offline" });
  await assert.rejects(api.getUserCollection(), /Impossible/);
  queryError(null);
  assert.equal((await api.getUserCollection()).length, 0);
});
