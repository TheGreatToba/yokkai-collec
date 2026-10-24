// Local PostgreSQL staging only: no network, published port, credentials or mounts.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { bootstrapSQL } from "./replay-migrations.mjs";
import { exerciseGlobalBinders } from "../tests/helpers/global-binders.mjs";

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  if (
    !["--snapshot", "--report"].includes(process.argv[index]) ||
    !process.argv[index + 1]
  )
    throw new Error(
      "Use --snapshot local-catalogue.json --report local-report.json"
    );
  options.set(process.argv[index], process.argv[index + 1]);
}
if (!options.has("--report"))
  throw new Error("A local report path is required");
const docker = (args, input) =>
  execFileSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"]
  }).trim();
const endpoint =
  process.env.DOCKER_HOST ||
  docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
assert.match(
  endpoint,
  /^(?:npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/)/,
  "Remote Docker is forbidden"
);
const container = docker([
  "run",
  "--detach",
  "--network",
  "none",
  "--name",
  "yokkai-binder-staging-" + randomUUID().slice(0, 8),
  "--env",
  "POSTGRES_USER=supabase_admin",
  "--env",
  "POSTGRES_HOST_AUTH_METHOD=trust",
  "--tmpfs",
  "/docker-entrypoint-initdb.d",
  "supabase/postgres:17.6.1.136"
]);
assert.match(container, /^[0-9a-f]{64}$/);
const started = Date.now(),
  report = {
    status: "FAIL",
    engine: "PostgreSQL 17 / isolated Docker",
    network: "none",
    synthetic_players: true,
    checks: []
  };
const literal = value =>
  value == null ? "null" : "'" + String(value).replaceAll("'", "''") + "'";
const sql = (statement, database = "global_binders_staging") =>
  docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1"
    ],
    statement
  );
let sessionRole = "",
  sessionSubject = "";
const sessionSQL = statement =>
  sql(
    `set request.jwt.claim.sub=${literal(sessionSubject)}; ${sessionRole ? `set role ${sessionRole};` : ""} ${statement}`
  );
const db = {
  async exec(statement) {
    sessionSQL(statement);
    for (const match of statement.matchAll(
      /\b(reset role|set role (authenticated|anon|postgres))/gi
    ))
      sessionRole = match[2] || "";
  },
  async query(statement, args = []) {
    const bound = statement.replace(/\$(\d+)/g, (_, n) =>
      literal(args[Number(n) - 1])
    );
    if (statement.includes("set_config('request.jwt.claim.sub'"))
      sessionSubject = args[0];
    return {
      rows: JSON.parse(
        sessionSQL(
          `select coalesce(json_agg(row_to_json(result)),'[]'::json) from (${bound}) result`
        )
      )
    };
  }
};
const value = async statement => (await db.query(statement)).rows[0].value;
const fingerprint = async table =>
  value(
    `select md5(coalesce(string_agg(row_to_json(t)::text,E'\n' order by row_to_json(t)::text),'')) as value from public.${table} t`
  );
try {
  for (let attempt = 0; ; attempt++) {
    try {
      sql("select 1", "postgres");
      break;
    } catch (error) {
      if (attempt === 90) throw error;
      await delay(1000);
    }
  }
  sql(
    "create role postgres login nosuperuser bypassrls createrole; create role anon; create role authenticated; create role service_role bypassrls; create database global_binders_staging owner postgres;",
    "postgres"
  );
  sql(`set role postgres; ${bootstrapSQL}`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const migrations = readdirSync(directory)
    .filter(name => name.endsWith(".sql"))
    .sort();
  const feature = migrations.filter(name => /^2026102420000[01]_/.test(name));
  assert.equal(feature.length, 2);
  for (const name of migrations.filter(name => !feature.includes(name)))
    sql(`set role postgres; ${readFileSync(new URL(name, directory), "utf8")}`);
  report.checks.push("PASS baseline schema replay before feature migration");
  if (options.has("--snapshot")) {
    const snapshot = JSON.parse(
      readFileSync(options.get("--snapshot"), "utf8")
    );
    for (let index = 0; index < snapshot.cards.length; index += 500) {
      const cards = snapshot.cards.slice(index, index + 500);
      sql(`insert into public.cards(id,source_id,nom,categorie,franchise,franchise_romaji,rarete_base,image_url,description,source)
        select id,source_id,nom,categorie,franchise,franchise_romaji,'C','https://example.test/staging-card.png','Staging metadata fixture',source
        from jsonb_to_recordset(${literal(JSON.stringify(cards))}::jsonb) x(id uuid,source_id text,nom text,categorie text,franchise text,franchise_romaji text,source text);`);
    }
    sql("delete from public.card_franchises");
    const links = snapshot.cards.flatMap(card =>
      card.links.map(link => ({ card_id: card.id, ...link }))
    );
    for (let index = 0; index < links.length; index += 1000)
      sql(`insert into public.card_franchises(card_id,franchise,position)
      select card_id,franchise,position from jsonb_to_recordset(${literal(JSON.stringify(links.slice(index, index + 1000)))}::jsonb) x(card_id uuid,franchise text,position smallint)`);
    report.catalogue_snapshot_at = snapshot.captured_at;
    report.catalogue_cards = snapshot.cards.length;
    report.catalogue_links = links.length;
    console.log(
      `Staging loaded: ${snapshot.cards.length} catalogue cards, ${links.length} original links; no real player records`
    );
  }
  const before = {};
  for (const table of [
    "cards",
    "card_franchises",
    "card_categories",
    "user_cards",
    "user_profiles",
    "panini_album_favorites",
    "wishlists",
    "folders"
  ])
    before[table] = await fingerprint(table);
  for (const name of feature)
    sql(`set role postgres; ${readFileSync(new URL(name, directory), "utf8")}`);
  for (const table of Object.keys(before))
    assert.equal(await fingerprint(table), before[table], table);
  report.checks.push(
    "PASS feature installation preserves every loaded source row and player table"
  );
  sql(
    `set role postgres; ${readFileSync(new URL(feature[1], directory), "utf8")}`
  );
  report.checks.push("PASS identical mapping seed is idempotent");
  if (options.has("--snapshot")) {
    sql(
      "select public.validate_global_binder_mapping(); update public.global_binder_settings set enabled=true,preferences_global=true where singleton"
    );
    const aliases = JSON.parse(
      readFileSync(
        new URL("../supabase/data/global-binder-aliases.json", import.meta.url),
        "utf8"
      )
    );
    const lookup = new Map(
      aliases.map(row => [
        row.category + "\0" + row.source_license,
        row.binder_license
      ])
    );
    const snapshot = JSON.parse(
      readFileSync(options.get("--snapshot"), "utf8")
    );
    const expected = new Map();
    for (const card of snapshot.cards)
      for (const link of card.links) {
        const target =
          lookup.get(card.categorie + "\0" + link.franchise) || link.franchise;
        if (!expected.has(target)) expected.set(target, new Set());
        expected.get(target).add(card.id);
      }
    const actual = (
      await db.query(
        "select franchise,count(*)::integer as total from public.global_binder_card_franchises group by franchise"
      )
    ).rows;
    assert.equal(actual.length, expected.size);
    for (const row of actual)
      assert.equal(row.total, expected.get(row.franchise)?.size, row.franchise);
    for (const table of Object.keys(before))
      assert.equal(await fingerprint(table), before[table], table);
    report.projected_binders = actual.length;
    report.checks.push(
      "PASS every projected binder count agrees with an independent full-catalogue UUID-set calculation"
    );
    sql(
      "update public.global_binder_settings set enabled=false where singleton"
    );
  }
  report.checks.push(...(await exerciseGlobalBinders(db)));
  report.status = "PASS";
} catch (error) {
  report.error =
    error.stderr
      ?.toString()
      .split("\n")
      .filter(line => /ERROR|DETAIL|CONTEXT/.test(line))
      .slice(-6)
      .join("\n") || error.message;
  process.exitCode = 1;
} finally {
  report.elapsed_seconds = Math.round((Date.now() - started) / 1000);
  writeFileSync(
    resolve(options.get("--report")),
    JSON.stringify(report, null, 2) + "\n"
  );
  docker(["rm", "--force", container]);
  console.log(JSON.stringify(report, null, 2));
}
