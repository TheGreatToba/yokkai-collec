import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const card = (n, rarity = "C") => ({ id: String(n).padStart(6, "0"), nom: `Carte ${n}`,
  categorie: "Anime/Manga", franchise: `Anime ${n}`, rarete_base: rarity, image_url: "https://storage.example/image.png" });
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
  let karasBalance = 0;
  const calls = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: user ? { user: { id: user } } : null }, error: null }),
      onAuthStateChange: (fn) => { listener = fn; },
    },
    from(table) {
      let after = "";
      let selectedUser;
      let selectedIds;
      let limit;
      const query = {
        select: () => query,
        order: (column) => { assert.equal(column, "id"); return query; },
        limit: (value) => { limit = value; return query; },
        gt: (column, value) => { assert.equal(column, "id"); after = value; return query; },
        eq: (column, value) => { assert.equal(column, "user_id"); selectedUser = value; return query; },
        in: (column, values) => { assert.equal(column, "id"); selectedIds = values; return query; },
        then(resolve) {
          calls.push({ table, after, selectedUser });
          const data = (table === "cards" ? catalogue : collection.filter((c) => c.user_id === selectedUser))
            .filter((c) => c.id > after && (!selectedIds || selectedIds.includes(c.id))).sort((a, b) => a.id.localeCompare(b.id)).slice(0, Math.min(limit ?? Infinity, apiLimit));
          return Promise.resolve({ data, error: queryError }).then(resolve);
        },
      };
      return query;
    },
    async rpc(name, args) {
      if (!["evolve_ssr_card", "discard_collection_card", "discard_decision_pack_card", "get_pack_destruction_values", "set_card_custom_image"].includes(name)) assert.equal(args, undefined); // Draw parameters remain server-owned.
      calls.push({ rpc: name });
      await rpcHook?.();
      if (rpcError) return { data: null, error: rpcError };
      if (name === "get_game_info") return { data: { user: { id: user, name: user },
        categories: ["Anime/Manga"], rarities: ["C", "R", "SR", "SSR", "LR"],
        dropRates: [{ rarity: "C", percent: 71.9 }, { rarity: "R", percent: 20 }, { rarity: "SR", percent: 7 }, { rarity: "SSR", percent: 1 }, { rarity: "LR", percent: 0.1 }], shinyRate: 0.1, karasBalance }, error: null };
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
      if (name === "get_pack_destruction_values") return { data: Object.fromEntries(args.p_instance_ids.map(instanceId => {
        const copy=collection.find(item=>item.id===instanceId&&item.user_id===user);
        return [instanceId,{C:1,R:2,SR:3,SSR:4,LR:5}[copy.rarity]];
      })), error:null };
      if (name === "discard_collection_card") {
        const index = collection.findIndex((copy) => copy.id === args.p_card_instance_id && copy.user_id === user);
        if (index < 0) return { data: null, error: { message: "CARD_NOT_OWNED" } };
        const [discarded] = collection.splice(index, 1);
        karasBalance += { C: 1, R: 2, SR: 3, SSR: 4, LR: 5 }[discarded.cards.rarete_base];
        return { data: karasBalance, error: null };
      }
      assert.fail(name);
    },
  };
  const TestDate = class extends Date { static now() { return now; } };
  const testWindow = { get localStorage() { assert.fail("Must not access v0.1 localStorage"); } };
  const playerStateContext = { exports: {}, Date: TestDate, window: testWindow, BroadcastChannel: undefined, Set, Map, Promise };
  const playerStateSource = ts.transpileModule(readFileSync(new URL("../lib/data/player-state.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(playerStateSource, playerStateContext);
  const context = { exports: {}, Date: TestDate,
    window: testWindow,
    require: (name) => {
      if (name === "@/lib/ui/card-search") return { cardSearchTerms: query => query.replace(/[,%()]/g, " ").trim().toLocaleLowerCase("fr-FR").split(/\s+/).filter(Boolean) };
      if (name === "@/lib/data/player-state") return playerStateContext.exports;
      assert.equal(name, "@/utils/supabase/client"); return { createClient: () => client };
    },
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

test("collection : la rareté vient du catalogue, jamais du snapshot de l'exemplaire", async () => {
  const copy = owned(7, "alice", "C");
  copy.cards.rarete_base = "LR";
  const { api } = setup({ collection: [copy] });
  assert.equal((await api.getUserCollection())[0].rarity, "LR");
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

test("infos réelles, nouveaux taux et copies défensives", async () => {
  const { api, calls } = setup();
  const info = await api.getGameInfo();
  assert.equal(info.user.id, "alice");
  assert.deepEqual(Array.from(info.dropRates, (r) => r.percent), [71.9, 20, 7, 1, 0.1]);
  assert.equal(info.shinyRate, 0.1);
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
  const { api, calls } = setup({ catalogue: [card(1, "SSR"), card(2, "C")] });
  assert.equal((await api.getUserCollection()).length, 0);
  const draw = await api.openBooster();
  assert.deepEqual(Array.from(draw, (c) => c.rarity), ["C", "SSR"]);
  assert.deepEqual(Array.from(draw, (c) => c.anime), ["Anime 2", "Anime 1"]);
  assert.equal((await api.getUserCollection()).length, 2);
  assert.equal(calls.filter((c) => c.rpc === "open_regular_pack").length, 1);
});

test("destruction : invalide immédiatement la collection et le solde de Karas", async () => {
  const { api, calls } = setup({ collection: [owned(1, "alice", "SSR")] });
  assert.equal((await api.getGameInfo()).karasBalance, 0);
  assert.equal((await api.getUserCollection()).length, 1);
  assert.equal(await api.discardPackCard("000001", "regular"), 4);
  assert.equal((await api.getUserCollection()).length, 0);
  assert.equal((await api.getGameInfo()).karasBalance, 4);
  assert.equal(calls.filter((call) => call.rpc === "get_game_info").length, 2);
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

test("une carte aux enchères affiche une erreur métier lors de sa destruction", async () => {
  const { api, rpcError } = setup();
  rpcError({ message: "CARD_FROZEN", code: "P0001" });
  await assert.rejects(
    api.discardPackCard("000001", "regular"),
    /Cette carte est placée aux enchères, elle ne peut pas être détruite\./,
  );
});

test("une URL Imgur refusée affiche un message français sans mojibake", async () => {
  const { api, rpcError } = setup();
  rpcError({ message: "INVALID_IMGUR_URL", code: "P0001" });
  await assert.rejects(api.setCardCustomImage("000001", "https://example.test/image.png"), {
    message: "Saisissez un lien Imgur valide commençant par https://i.imgur.com/ ou https://imgur.com/.",
  });
});
