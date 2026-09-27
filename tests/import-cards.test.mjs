import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { cardNameCategoryKey, downloadImage, imagePath, importCards, planNameCategoryImport,
  prepareStorage, readCards, retry, validateCard } from "../scripts/import-cards.mjs";

const row = (id = "1") => ({ source_id: id, nom: "Personnage", categorie: "Anime/Manga",
  franchise: "", franchise_romaji: "", image_url: `https://s4.anilist.co/${id}.png`,
  favoris_count: "12", rarete_base: "C", source: "anilist" });
const image = () => new Response(new Uint8Array([137, 80, 78, 71]), {
  headers: { "content-type": "image/png" },
});
const silent = () => {};

test("plan (nom, categorie) : updates, inserts et collisions strictes", () => {
  const existing = [{ ...validateCard({ ...row(), source_id: "old", nom: "IU", categorie: "KPOP" }),
    id: "stable-id", image_url: "https://project.supabase.co/old" }];
  const updated = { ...row(), source_id: "", nom: "IU", categorie: "KPOP", rarete_base: "LR",
    franchise: "Solo", source: "manual" };
  const added = { ...row(), source_id: "", nom: "NewJeans", categorie: "KPOP", source: "manual" };
  const plan = planNameCategoryImport([updated, added], existing);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].current.id, "stable-id");
  assert.equal(plan.updates[0].card.rarete_base, "LR");
  assert.equal(plan.inserts.length, 1);
  assert.equal(cardNameCategoryKey(plan.inserts[0]), JSON.stringify(["NewJeans", "KPOP"]));
  assert.throws(() => planNameCategoryImport([updated, updated], existing), /Collision CSV/);
  assert.throws(() => planNameCategoryImport([updated], [...existing, { ...existing[0], id: "other" }]),
    /Collision en base/);
});

function fakeClient({ uploadError, dbError, buckets = [], schemaError } = {}) {
  const cards = new Map();
  const uploads = new Map();
  const batches = [];
  const created = [];
  return {
    cards, uploads, batches, created,
    from(table) {
      assert.equal(table, "cards");
      return {
        select() { return { limit: async () => ({ error: schemaError }) }; },
        async upsert(rows, options) {
          assert.equal(options.onConflict, "source,source_id");
          assert.equal(options.defaultToNull, false);
          if (dbError) return { error: dbError };
          batches.push(rows);
          for (const card of rows) {
            assert.ok(card.image_url.startsWith("https://project.supabase.co/storage/v1/object/public/"));
            assert.equal("id" in card, false);
            assert.equal("date_ajout" in card, false);
            const key = JSON.stringify([card.source, card.source_id]);
            cards.set(key, { id: "existing-uuid", date_ajout: "original-date", ...cards.get(key), ...card });
          }
          return { error: null };
        },
      };
    },
    storage: {
      async listBuckets() { return { data: buckets, error: null }; },
      async createBucket(id, options) { created.push({ id, ...options }); return { error: null }; },
      from(bucket) {
        return {
          async upload(path, bytes, options) {
            assert.equal(options.upsert, true);
            if (uploadError) return { error: uploadError };
            uploads.set(path, bytes);
            return { error: null };
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}` } };
          },
        };
      },
    },
  };
}

test("CSV streaming : BOM, accents, virgules, guillemets, multiligne et en-tête invalide", async () => {
  const dir = await mkdtemp(join(tmpdir(), "yokkai-csv-"));
  try {
    const path = join(dir, "cards.csv");
    await writeFile(path, '\uFEFFsource_id,nom,categorie,franchise,franchise_romaji,image_url,favoris_count,rarete_base,source\r\n1,"Été, ""Luffy""\nMonkey",Anime/Manga,,,https://s4.anilist.co/a.png,,LR,anilist\r\n');
    const rows = [];
    for await (const card of readCards(path)) rows.push(validateCard(card));
    assert.equal(rows[0].nom, 'Été, "Luffy"\nMonkey');
    assert.equal(rows[0].franchise_romaji, null);
    assert.equal(rows[0].favoris_count, null);
    assert.equal(rows[0].rarete_base, "LR");
    const command = spawnSync(process.execPath, ["scripts/import-cards.mjs", "--dry-run", "--csv", path], {
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    assert.match(command.stdout, /"read":1,"imported":0,"valid":1/);
    await writeFile(path, "id,nom\n1,A\n");
    await assert.rejects(async () => { for await (const item of readCards(path)) void item; }, /manquantes/);
    await assert.rejects(async () => { for await (const item of readCards(join(dir, "absent"))) void item; }, /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validation : entiers, rareté, image par défaut et identifiants", () => {
  for (const patch of [{ favoris_count: "-1" }, { favoris_count: "1.5" },
    { favoris_count: "2147483648" }, { rarete_base: "SHINY" }, { source_id: " " },
    { image_url: "https://s4.anilist.co/character/large/default.jpg" }]) {
    assert.throws(() => validateCard({ ...row(), ...patch }));
  }
  assert.notEqual(imagePath(row()), imagePath({ ...row(), source: "other" }));
});

test("manual cards receive a stable derived identifier", () => {
  const first = validateCard({ ...row(""), source: "manual", categorie: "KPOP", nom: "BLACKPINK" });
  const second = validateCard({ ...row(""), source: "manual", categorie: "kpop", nom: "blackpink" });
  assert.match(first.source_id, /^manual-[a-f0-9]{24}$/);
  assert.equal(first.source_id, second.source_id);
});

test("lots, échec image ignoré, erreurs journalisées et reprise sans doublons", async () => {
  const client = fakeClient();
  const errors = [];
  let requests = 0;
  const options = { rows: [row("1"), row("2"), row("3"), row("4")], client,
    batchSize: 2, concurrency: 2, log: silent, sleep: async () => {},
    onFailure: async (entry) => errors.push(entry),
    fetchImage: async (url, init) => {
      assert.deepEqual(init.headers, { "User-Agent": "Yokkai-Collec/0.1" });
      requests++;
      if (url.endsWith("2.png")) return new Response("missing", { status: 404 });
      return image();
    } };
  const result = await importCards(options);
  assert.equal(requests, 4); // No retry on 404.
  assert.equal(result.imported, 3);
  assert.equal(result.skipped, 1);
  assert.equal(result.batches, 2);
  assert.equal(errors[0].source_id, "2");
  assert.equal(errors[0].stage, "image");
  await importCards(options);
  assert.equal(client.cards.size, 3);
  assert.equal(client.uploads.size, 3);
  assert.ok([...client.cards.values()].every((card) => card.id === "existing-uuid" && card.date_ajout === "original-date"));
});

test("429/5xx sont retentés, contrairement aux erreurs permanentes", async () => {
  let attempts = 0;
  let waits = 0;
  assert.equal(await retry(async () => {
    if (++attempts < 3) throw Object.assign(new Error("rate limited"), { status: 429 });
    return "ok";
  }, 3, async () => { waits++; }), "ok");
  assert.equal(waits, 2);
  await assert.rejects(retry(async () => {
    throw Object.assign(new Error("unavailable"), { status: 503 });
  }, 3, async () => {}), /unavailable/);
});

test("rejet HTML, corps vide et images trop volumineuses même sans Content-Length", async () => {
  await assert.rejects(downloadImage("https://image", async () => new Response("html", {
    headers: { "content-type": "text/html" },
  })), /non image/);
  await assert.rejects(downloadImage("https://image", async () => new Response(null, {
    headers: { "content-type": "image/png" },
  })), /vide/);
  await assert.rejects(downloadImage("https://image", async () => new Response(new Uint8Array(6 * 1024 * 1024 + 1), {
    headers: { "content-type": "image/png" },
  })), /6 Mio/);
});

test("limite et dry-run ne contactent ni images ni Supabase", async () => {
  const result = await importCards({ rows: [row("1"), row("2"), row("3")],
    dryRun: true, limit: 2, batchSize: 1, log: silent,
    fetchImage: () => assert.fail("network called") });
  assert.equal(result.read, 2);
  assert.equal(result.valid, 2);
  assert.equal(result.imported, 0);
});

test("la concurrence des téléchargements reste bornée", async () => {
  let active = 0;
  let peak = 0;
  const result = await importCards({ rows: Array.from({ length: 9 }, (_, i) => row(String(i))),
    client: fakeClient(), batchSize: 4, concurrency: 2, log: silent,
    fetchImage: async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setImmediate(resolve));
      active--;
      return image();
    } });
  assert.equal(peak, 2);
  assert.equal(result.imported, 9);
  assert.equal(result.batches, 3);
});

test("doublons CSV dans un lot : une seule écriture et dernière ligne conservée", async () => {
  const client = fakeClient();
  const stats = await importCards({ rows: [row(), { ...row(), nom: "Dernière version" }],
    client, fetchImage: async () => image(), log: silent });
  assert.equal(stats.duplicates, 1);
  assert.equal(client.batches[0].length, 1);
  assert.equal(client.batches[0][0].nom, "Dernière version");
});

test("erreur Storage : arrêt, aucune carte insérée ; erreur DB : arrêt explicite", async () => {
  const client = fakeClient({ uploadError: { message: "unauthorized", statusCode: "403" } });
  await assert.rejects(importCards({ rows: [row()], client, fetchImage: async () => image(), log: silent }), /unauthorized/);
  assert.equal(client.cards.size, 0);
  await assert.rejects(importCards({ rows: [row()], client: fakeClient({ dbError: { message: "DB failure" } }),
    fetchImage: async () => image(), log: silent }), /DB failure/);
});

test("préflight : schéma requis puis création du bucket public, bucket existant préservé", async () => {
  const client = fakeClient();
  await prepareStorage(client, "card-images");
  assert.equal(client.created[0].public, true);
  assert.equal(client.created[0].fileSizeLimit, 6 * 1024 * 1024);
  const existing = fakeClient({ buckets: [{ id: "card-images", public: true }] });
  await prepareStorage(existing, "card-images");
  assert.equal(existing.created.length, 0);
  await assert.rejects(prepareStorage(fakeClient({ buckets: [{ id: "card-images", public: false }] }), "card-images"), /pas public/);
  const missing = fakeClient({ schemaError: { message: "missing table" } });
  await assert.rejects(prepareStorage(missing, "card-images"), /missing table/);
  assert.equal(missing.created.length, 0);
});
