import { createReadStream } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";

const COLUMNS = ["source_id", "nom", "categorie", "franchise", "franchise_romaji",
  "image_url", "favoris_count", "rarete_base", "source"];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function* readCards(path) {
  const input = createReadStream(path);
  const parser = parse({
    bom: true, skip_empty_lines: true, max_record_size: 1024 * 1024,
    record_delimiter: ["\r\n", "\n", "\r"],
    columns(headers) {
      const missing = COLUMNS.filter((column) => !headers.includes(column));
      if (missing.length) throw new Error(`Colonnes CSV manquantes : ${missing.join(", ")}`);
      if (new Set(headers).size !== headers.length) throw new Error("Colonnes CSV dupliquées.");
      return headers;
    },
  });
  input.on("error", (error) => parser.destroy(error));
  input.pipe(parser);
  try {
    yield* parser;
  } finally {
    input.destroy();
    parser.destroy();
  }
}

export function validateCard(row) {
  const card = Object.fromEntries(COLUMNS.map((column) => [column, row[column]?.trim() ?? ""]));
  if (!card.source_id && card.source === "manual" && card.nom && card.categorie) {
    const identity = `${card.categorie.toLocaleLowerCase("fr")}\0${card.nom.toLocaleLowerCase("fr")}`;
    card.source_id = `manual-${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
  }
  // The cleaned AniList CSV can contain unknown franchises (empty text is valid in DB).
  for (const column of ["source_id", "nom", "categorie", "source", "image_url"]) {
    if (!card[column]) throw new Error(`Champ vide : ${column}`);
  }
  if (!["C", "R", "SR", "SSR", "LR"].includes(card.rarete_base)) {
    throw new Error("Rareté invalide.");
  }
  if (card.favoris_count !== "" &&
      (!/^\d+$/.test(card.favoris_count) || Number(card.favoris_count) > 2147483647)) {
    throw new Error("favoris_count doit être un entier PostgreSQL positif ou nul.");
  }
  const url = new URL(card.image_url);
  if (url.protocol !== "https:") throw new Error("L'image doit utiliser HTTPS.");
  if (url.pathname.endsWith("/default.jpg")) throw new Error("Image AniList par défaut.");
  card.favoris_count = card.favoris_count === "" ? null : Number(card.favoris_count);
  card.franchise_romaji ||= null;
  return card;
}

function failure(message, status) {
  return Object.assign(new Error(message), { status });
}

export async function retry(operation, attempts = 3, sleep = delay) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error.status ?? error.statusCode);
      const transient = [0, 408, 429].includes(status) || status >= 500 ||
        error.name === "TimeoutError" || error.name === "AbortError" || error instanceof TypeError;
      if (!transient || attempt >= attempts) throw error;
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 10000));
    }
  }
}

export async function downloadImage(url, fetchImage = fetch, timeoutMs = 30000) {
  // Never forward the Supabase client's authorization headers to image hosts.
  const response = await fetchImage(url, {
    headers: { "User-Agent": "Yokkai-Collec/0.1" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw failure(`Téléchargement HTTP ${response.status}`, response.status);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!MIME_TYPES.includes(contentType)) {
    await response.body?.cancel();
    throw new Error("Réponse non image ou format non pris en charge.");
  }
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error("Image supérieure à 6 Mio.");
  }
  if (!response.body) throw new Error("Image vide.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) throw new Error("Image supérieure à 6 Mio.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (!size) throw new Error("Image vide.");
  return { bytes: Buffer.concat(chunks), contentType };
}

export function imagePath(card) {
  // Stable, collision-resistant names; no user-provided path fragments.
  return `${createHash("sha256").update(JSON.stringify([card.source, card.source_id])).digest("hex")}`;
}

async function checked(request) {
  const result = await request;
  if (result.error) throw Object.assign(new Error(result.error.message), {
    status: result.error.statusCode ?? result.status,
    code: result.error.code,
  });
  return result.data;
}

export async function prepareStorage(client, bucket) {
  // Fail before downloading or creating a bucket if step 1 is missing.
  await retry(() => checked(client.from("cards").select(
    "id,source_id,nom,categorie,franchise,franchise_romaji,rarete_base,image_url,favoris_count,description,source,date_ajout",
  ).limit(0)));
  const buckets = await retry(() => checked(client.storage.listBuckets()));
  const existing = buckets.find(({ id }) => id === bucket);
  if (existing) {
    if (!existing.public) throw new Error(`Le bucket ${bucket} existe mais n'est pas public.`);
    return;
  }
  await retry(() => checked(client.storage.createBucket(bucket, {
    public: true, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes: MIME_TYPES,
  })));
}

export async function importCards({ rows, client, bucket = "card-images", batchSize = 100,
  concurrency = 5, limit = Infinity, dryRun = false, fetchImage = fetch,
  log = console.log, onFailure = async () => {}, sleep = delay }) {
  const stats = { read: 0, imported: 0, valid: 0, skipped: 0, duplicates: 0, batches: 0 };
  const started = Date.now();
  let batch = [];
  async function skip(row, index, stage, error) {
    stats.skipped++;
    // Log only identifiers and the error, never keys or signed image URLs.
    const entry = { record: index, source: row.source, source_id: row.source_id,
      stage, message: error.message };
    await onFailure(entry);
    log(`SKIP ${JSON.stringify(entry)}`);
  }
  async function flush() {
    const ready = [];
    // Deduplicate before uploads to avoid simultaneous writes to the same object.
    const work = [...new Map(batch.map((entry) => {
      let identity = entry.row.source_id?.trim();
      if (!identity && entry.row.source?.trim() === "manual") {
        identity = `${entry.row.categorie?.trim().toLocaleLowerCase("fr")}\0${entry.row.nom?.trim().toLocaleLowerCase("fr")}`;
      }
      return [JSON.stringify([entry.row.source?.trim(), identity]), entry];
    })).values()];
    stats.duplicates += batch.length - work.length;
    let cursor = 0;
    let fatal;
    await Promise.all(Array.from({ length: Math.min(concurrency, work.length) }, async () => {
      try {
        while (!fatal && cursor < work.length) {
          const { row, index } = work[cursor++];
          let card;
          try {
            card = validateCard(row);
          } catch (error) {
            await skip(row, index, "validation", error);
            continue;
          }
          stats.valid++;
          if (dryRun) continue;
          let image;
          try {
            image = await retry(() => downloadImage(card.image_url, fetchImage), 3, sleep);
          } catch (error) {
            await skip(row, index, "image", error);
            continue;
          }
          const path = imagePath(card);
          // Storage or DB failures stop the run: configuration/quota errors must
          // not silently skip an entire catalogue. A rerun safely reuses paths.
          await retry(() => checked(client.storage.from(bucket).upload(path, image.bytes, {
            contentType: image.contentType, upsert: true, cacheControl: "3600",
          })), 3, sleep);
          card.image_url = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
          ready.push({ card, index });
        }
      } catch (error) {
        fatal ??= error;
      }
    }));
    // Wait for in-flight workers before failing; no background mutations after return.
    if (fatal) throw fatal;
    if (ready.length) {
      ready.sort((a, b) => a.index - b.index);
      await retry(() => checked(client.from("cards").upsert(ready.map(({ card }) => card), {
        onConflict: "source,source_id", defaultToNull: false,
      })), 3, sleep);
      stats.imported += ready.length;
    }
    stats.batches++;
    log(`Lot ${stats.batches} | lues=${stats.read} | valides=${stats.valid} | écrites=${stats.imported} | ignorées=${stats.skipped} | doublons=${stats.duplicates} | ${Math.round((Date.now() - started) / 1000)}s`);
    batch = [];
  }
  for await (const row of rows) {
    if (stats.read >= limit) break;
    batch.push({ row, index: ++stats.read });
    if (batch.length >= batchSize) await flush();
  }
  if (batch.length) await flush();
  return stats;
}

async function main() {
  const { values } = parseArgs({ options: {
    csv: { type: "string", default: "data/characters_clean.csv" },
    bucket: { type: "string", default: "card-images" },
    "batch-size": { type: "string", default: "100" },
    concurrency: { type: "string", default: "5" },
    limit: { type: "string" },
    "error-log": { type: "string", default: "logs/import-cards-errors.jsonl" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  } });
  if (values.help) {
    console.log("npm run import:cards -- [--csv data/characters_clean.csv] [--dry-run] [--limit 10] [--batch-size 100] [--concurrency 5] [--bucket card-images] [--error-log logs/import-cards-errors.jsonl]");
    return;
  }
  const positive = (name, max) => {
    const value = Number(values[name]);
    if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
      throw new Error(`--${name} doit être un entier entre 1 et ${max}.`);
    }
    return value;
  };
  const batchSize = positive("batch-size", 1000);
  const concurrency = positive("concurrency", 20);
  const limit = values.limit ? positive("limit", Number.MAX_SAFE_INTEGER) : Infinity;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(values.bucket)) throw new Error("Nom de bucket invalide.");
  let client;
  if (!values["dry-run"]) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Renseigner NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) dans .env.local. La clé publique ne permet pas l'import.");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(60000) }) },
    });
    await prepareStorage(client, values.bucket);
  }
  const errorLog = resolve(values["error-log"]);
  if (errorLog === resolve(values.csv)) throw new Error("Le journal ne peut pas remplacer le CSV.");
  await mkdir(dirname(errorLog), { recursive: true });
  // Serialize concurrent failures to keep JSONL entries intact.
  let writes = Promise.resolve();
  const onFailure = (entry) => {
    writes = writes.then(() => appendFile(errorLog,
      JSON.stringify({ date: new Date().toISOString(), ...entry }) + "\n", "utf8"));
    return writes;
  };
  console.log(values["dry-run"] ? "Validation locale du CSV (aucun accès réseau)." : `Import vers ${values.bucket}, lots de ${batchSize}, concurrence ${concurrency}.`);
  const stats = await importCards({ rows: readCards(values.csv), client, bucket: values.bucket,
    batchSize, concurrency, limit, dryRun: values["dry-run"], onFailure });
  console.log(`Terminé : ${JSON.stringify(stats)}`);
  if (stats.skipped) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    // Do not dump request objects or credentials on errors.
    const secrets = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
    let message = error.message;
    for (const secret of secrets) message = message.replaceAll(secret, "[REDACTED]");
    console.error(`Import arrêté : ${message}`);
    process.exitCode = 1;
  });
}
