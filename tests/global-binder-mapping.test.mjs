import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGlobalBinderMapping } from "../scripts/build-global-binder-mapping.mjs";
const row = (source, target) => ({
  category: "ANIME/MANGA",
  source_license: source,
  binder_license: target,
  evidence: "synthetic fixture"
});

test("explicit mapping rejects unknown sources, category collisions, duplicates and chains", () => {
  assert.throws(
    () => buildGlobalBinderMapping([row("A", "B"), row("B", "C")]),
    /chain/
  );
  assert.throws(
    () => buildGlobalBinderMapping([row("A", "B"), row("A", "B")]),
    /Duplicate/
  );
  assert.throws(
    () => buildGlobalBinderMapping([row("A", "B")], { cards: [] }),
    /Unknown/
  );
  assert.throws(
    () =>
      buildGlobalBinderMapping([row("A", "B")], {
        cards: [{ categorie: "VIDEO GAMES", links: [{ franchise: "A" }] }]
      }),
    /Category/
  );
  const a = buildGlobalBinderMapping([row("A", "Target"), row("B", "Target")]);
  const b = buildGlobalBinderMapping([row("B", "Target"), row("A", "Target")]);
  assert.equal(a.checksum, b.checksum);
});

test("versioned mapping preserves the editorial exclusions and matches its inactive SQL seed", () => {
  const rows = JSON.parse(
    readFileSync(
      new URL("../supabase/data/global-binder-aliases.json", import.meta.url),
      "utf8"
    )
  );
  const sources = new Map(
    rows.map(row => [row.source_license, row.binder_license])
  );
  for (const source of [
    "Yobi and Amari: Story of Spares",
    "Yobi, The Five Tailed Fox",
    "Shangri-la",
    "Shangri-La Frontier",
    "Plus-Sized Elf",
    "Plus-sized Misadventures in Love!",
    "Puella Magi Sonico Magica",
    "Umineko: When They Cry",
    "Fairy Tail",
    "Fate/Zero"
  ])
    assert.equal(sources.has(source), false, source);
  for (const source of [
    "THE IDOLM@STER CINDERELLA GIRLS",
    "IDOLM@STER: XENOGLOSSIA",
    "The Idol Master"
  ])
    assert.equal(sources.get(source), "THE IDOLM@STER");
  for (const source of ["Yu-Gi-Oh! GX", "Yu-Gi-Oh! ARC-V", "Yu-Gi-Oh! 5D's"])
    assert.equal(sources.get(source), "Yu-Gi-Oh!");
  assert.equal(sources.get("Sonic Heroes"), "Sonic the Hedgehog");
  const built = buildGlobalBinderMapping(rows);
  assert.equal(
    readFileSync(
      new URL(
        "../supabase/migrations/20261024200001_global_binder_mapping.sql",
        import.meta.url
      ),
      "utf8"
    ).replaceAll("\r\n", "\n"),
    built.sql
  );
  assert.ok(
    readFileSync(
      new URL(
        "../supabase/operations/enable-global-binders.sql",
        import.meta.url
      ),
      "utf8"
    ).includes(built.checksum)
  );
});
