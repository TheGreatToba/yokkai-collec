import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../lib/ui/license-progress.ts", import.meta.url),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText,
  context
);
const {
  buildLicenseCatalogueTotals,
  buildLicenseProgress,
  paniniAlbumForCard
} = context.exports;

const card = (instanceId, id, anime, category = "ANIME/MANGA") => ({
  instanceId,
  id,
  anime,
  category
});

test("le mode Panini compte les cartes uniques d'une licence", () => {
  const progress = buildLicenseProgress(
    [
      card("a1", "a", "One Piece"),
      card("a2", "a", "One Piece"),
      card("b1", "b", "One Piece")
    ],
    [{ license: "One Piece", total: 4 }]
  );
  assert.equal(progress[0].license, "One Piece");
  assert.equal(progress[0].total, 4);
  assert.equal(progress[0].owned, 2);
  assert.equal(progress[0].percent, 50);
});

test("les licences les plus complètes apparaissent en premier", () => {
  const progress = buildLicenseProgress(
    [card("a", "a", "Alpha")],
    [
      { license: "Beta", total: 2 },
      { license: "Alpha", total: 1 }
    ]
  );
  assert.deepEqual(
    progress.map(item => item.license),
    ["Alpha", "Beta"]
  );
});

test("les catégories éditoriales deviennent des albums Panini uniques", () => {
  const catalogue = [
    card("film-1", "film-1", "Alien", "FILM"),
    card("film-2", "film-2", "Matrix", "FILM"),
    card("kpop-1", "kpop-1", "BTS", "KPOP"),
    card("anime-1", "anime-1", "One Piece")
  ];

  assert.equal(paniniAlbumForCard(catalogue[0]), "FILM");
  assert.equal(paniniAlbumForCard(catalogue[2]), "KPOP");
  assert.equal(paniniAlbumForCard(catalogue[3]), "One Piece");
  assert.deepEqual(
    Array.from(
      buildLicenseCatalogueTotals(catalogue)
        .sort((a, b) => a.license.localeCompare(b.license))
        .map(item => [item.license, item.total]),
      item => Array.from(item)
    ),
    [
      ["FILM", 2],
      ["KPOP", 1],
      ["One Piece", 1]
    ]
  );
});

test("les possessions sont comptées dans leur album de catégorie", () => {
  const progress = buildLicenseProgress(
    [card("film-1", "film-1", "Alien", "FILM")],
    [{ license: "FILM", total: 2 }]
  );

  assert.equal(progress[0].owned, 1);
  assert.equal(progress[0].percent, 50);
});
