import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function buildGlobalBinderMapping(rows, snapshot) {
  const seen = new Set();
  for (const row of rows) {
    for (const key of [
      "category",
      "source_license",
      "binder_license",
      "evidence"
    ])
      if (typeof row[key] !== "string" || !row[key].trim())
        throw new Error(`Missing ${key}`);
    if (row.source_license.length > 200 || row.binder_license.length > 200)
      throw new Error(
        `License exceeds preference limit: ${row.source_license}`
      );
    if (row.category !== row.category.trim().toUpperCase())
      throw new Error(`Invalid category: ${row.category}`);
    if (
      row.source_license === row.binder_license ||
      seen.has(row.source_license)
    )
      throw new Error(`Duplicate/identity source: ${row.source_license}`);
    seen.add(row.source_license);
  }
  for (const row of rows)
    if (seen.has(row.binder_license))
      throw new Error(`Mapping chain: ${row.source_license}`);
  if (snapshot) {
    const categories = new Map();
    for (const card of snapshot.cards)
      for (const link of card.links) {
        if (!categories.has(link.franchise))
          categories.set(link.franchise, new Set());
        categories.get(link.franchise).add(card.categorie.trim().toUpperCase());
      }
    for (const row of rows) {
      const actual = categories.get(row.source_license);
      if (!actual) throw new Error(`Unknown source: ${row.source_license}`);
      if (actual.size !== 1 || !actual.has(row.category))
        throw new Error(`Category collision: ${row.source_license}`);
    }
  }
  const framed = [...rows]
    .sort((a, b) =>
      Buffer.compare(
        Buffer.from(a.source_license),
        Buffer.from(b.source_license)
      )
    )
    .map(row =>
      [row.category, row.source_license, row.binder_license, row.evidence]
        .map(value => Buffer.byteLength(value, "utf8") + ":" + value)
        .join("")
    )
    .join("");
  const checksum = createHash("sha256").update(framed).digest("hex");
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  const sql =
    "begin;\n\n-- Inactive by default. Reapplying identical seed data preserves activation state.\ndo $$ begin if exists(select 1 from public.global_binder_settings where manifest_sha256<>" +
    literal(checksum) +
    ") then raise exception 'GLOBAL_BINDER_SEED_DRIFT'; end if; end $$;\ninsert into public.global_binder_settings(singleton,enabled,manifest_sha256)\nvalues(true,false," +
    literal(checksum) +
    ") on conflict(singleton) do nothing;\n\ninsert into public.global_binder_aliases(category,source_license,binder_license,evidence) values\n" +
    rows
      .map(
        row =>
          "(" +
          [row.category, row.source_license, row.binder_license, row.evidence]
            .map(literal)
            .join(",") +
          ")"
      )
      .join(",\n") +
    "\non conflict(source_license) do nothing;\n\ndo $$ begin if public.global_binder_mapping_sha256()<>" +
    literal(checksum) +
    " then raise exception 'GLOBAL_BINDER_SEED_DRIFT'; end if; end $$;\n\ncommit;\n";
  return { checksum, sql };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    snapshotIndex = args.indexOf("--snapshot");
  if (
    args.some(
      (arg, index) =>
        !["--check", "--write", "--snapshot"].includes(arg) &&
        index !== snapshotIndex + 1
    )
  )
    throw new Error("Use --check or --write, optionally --snapshot local.json");
  const rows = JSON.parse(
    readFileSync(
      new URL("../supabase/data/global-binder-aliases.json", import.meta.url),
      "utf8"
    )
  );
  const snapshot =
    snapshotIndex >= 0
      ? JSON.parse(readFileSync(args[snapshotIndex + 1], "utf8"))
      : undefined;
  const { sql, checksum } = buildGlobalBinderMapping(rows, snapshot);
  const output = new URL(
    "../supabase/migrations/20261024200001_global_binder_mapping.sql",
    import.meta.url
  );
  if (args.includes("--write")) writeFileSync(output, sql);
  else if (readFileSync(output, "utf8").replaceAll("\r\n", "\n") !== sql)
    throw new Error("Generated mapping migration has drifted");
  const activation = readFileSync(
    new URL(
      "../supabase/operations/enable-global-binders.sql",
      import.meta.url
    ),
    "utf8"
  );
  if (!activation.includes(checksum))
    throw new Error(
      "Operator activation checksum requires explicit update/review"
    );
  console.log(
    JSON.stringify({
      status: "PASS",
      sources: rows.length,
      checksum,
      catalogue_checked: Boolean(snapshot)
    })
  );
}
