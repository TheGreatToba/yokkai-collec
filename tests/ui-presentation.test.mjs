import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const modules = new Map();
function load(relative) {
  const filename = path.join(root, relative);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {};
  modules.set(filename, exports);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (name.endsWith(".css")) return {};
      if (name === "@/lib/data/cards") return {
        getAllCards() { assert.fail("Presentational server render must not load the API"); },
        getUserCollection() { assert.fail("Presentational server render must not load the API"); },
      };
      if (name === "@/components/ui") return load("components/ui/index.tsx");
      if (name.startsWith("@/")) return load(`${name.slice(2)}.${name.includes("/hooks/") ? "ts" : "tsx"}`);
      return require(name);
    },
  }, { filename });
  return exports;
}
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const card = { id: "card-a", instanceId: "copy-a", name: "Carte de test", category: "Test", rarity: "SSR", image: "/test-image.png", obtainedAt: "2026-09-24T10:00:00Z" };

test("Shiny reste une surcouche SSR/LR et ne s'applique pas aux autres raretés", () => {
  const { YokaiCard } = load("components/yokai-card.tsx");
  for (const rarity of ["C", "R", "SR"]) {
    const html = render(YokaiCard, { ...card, rarity, shiny: true });
    assert.doesNotMatch(html, /yk-shiny-frame/);
  }
  for (const rarity of ["SSR", "LR"]) {
    const html = render(YokaiCard, { ...card, rarity, shiny: true, animated: false });
    assert.match(html, new RegExp(`yk-rarity-${rarity}`));
    assert.match(html, /yk-shiny-frame/);
    assert.doesNotMatch(html, /yk-animated|yk-sparkle/);
    assert.match(html, /test-image\.png/);
  }
});

test("la carte affiche la franchise dans son cadre sans répéter la catégorie générique", () => {
  const { YokaiCard } = load("components/yokai-card.tsx");
  const withFranchise = render(YokaiCard, { ...card, anime: "Black Clover", animated: false });
  assert.match(withFranchise, /yk-card-anime[^>]*[^]*Black Clover/);
  const withoutFranchise = render(YokaiCard, { ...card, category: "Anime\/Manga", anime: undefined, animated: false });
  assert.doesNotMatch(withoutFranchise, /yk-card-anime/);
});

test("un solde absent reste inconnu, un solde connu utilise fr-FR", () => {
  const { Karas } = load("components/ui/index.tsx");
  assert.match(render(Karas, {}), /Solde karas indisponible/);
  assert.match(render(Karas, {}), /—/);
  assert.match(render(Karas, { amount: 1240 }), /1[\s\u202f\u00a0]240/);
});

test("les modales imbriquées libèrent le scroll et la confirmation remplace le détail", () => {
  const modal = readFileSync(path.join(root, "components/ui/index.tsx"), "utf8");
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(modal, /modalLockCount = Math\.max\(0, modalLockCount - 1\)/);
  assert.match(modal, /if \(modalLockCount === 0\) document\.body\.style\.overflow = bodyOverflowBeforeModal/);
  assert.match(collection, /open=\{!!selected&&!discardConfirm\}/);
});

test("la destruction multiple est active et transmet tous les exemplaires sélectionnés", () => {
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(collection, /onDiscardMany\(selectedCards\.map\(card => card\.instanceId\)\)/);
  assert.match(collection, /bulkDiscardBusy\?"Destruction…":"Détruire la sélection"/);
  assert.doesNotMatch(collection, /Destruction bientôt disponible/);
  assert.match(game, /onDiscardMany=\{discardCollectionCards\}/);
});

test("la collection d'un autre joueur ne propose pas de sélection ou d'édition", () => {
  const { CollectionView } = load("components/collection.tsx");
  const html = render(CollectionView, { cards: [{...card,image:"https://i.imgur.com/private.png",catalogueImage:"/catalogue.png"}], categories: ["Test"], readOnly: true });
  assert.match(html, /Carte de test/);
  assert.match(html, /catalogue\.png/);
  assert.doesNotMatch(html, /private\.png/);
  assert.doesNotMatch(html, /Sélection multiple|Détruire la sélection|Modifier le profil/);
});

test("la collection annonce l'évolution de trois SSR non-Shiny en Shiny", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /Évolution Shiny/);
  assert.match(source, /Évoluer en Shiny \(consomme 3 exemplaires\)/);
  assert.doesNotMatch(source, /Évolution LR|Évoluer en LR/);
});

test("le Decision Pack confirmé affiche une carte gardée et quatre perdues", () => {
  const { BoosterReveal } = load("components/boosters.tsx");
  const cards = Array.from({ length: 5 }, (_, i) => ({ ...card, instanceId: `copy-${i}` }));
  const html = render(BoosterReveal, {
    cards, revealed: 5, onReveal() {}, onRevealAll() {}, onReturn() {},
    decision: { keptId: "copy-3", async onKeep() { assert.fail("Rendering must not confirm a choice"); } },
  });
  assert.equal((html.match(/yk-lost-stamp/g) || []).length, 4);
  assert.equal((html.match(/GARDÉE/g) || []).length, 1);
  assert.doesNotMatch(html, />Détruire</);
  assert.match(html, /Carte ajoutée à ta collection · \+0 Karas depuis les cartes non conservées/);
});

test("les six types de notifications ont un texte et une redirection", () => {
  const source = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  const model = readFileSync(path.join(root, "lib/data/notifications.ts"), "utf8");
  for (const type of ["wishlist_card_on_auction", "friend_request", "outbid", "trade_offer_received", "auction_won", "achievement_completed"]) {
    assert.match(model, new RegExp(type));
  }
  assert.match(source, /de ta wishlist vient d’être mise aux enchères — clique pour voir/);
  assert.match(source, /Tu as été surenchéri sur/);
  assert.match(source, /Tu as remporté/);
  assert.match(source, /t’a envoyé une offre d’échange/);
  assert.match(source, /Nouveau succès/);
  assert.match(source, /veut t’ajouter en ami/);
  for (const href of ["/marche/", "/amis", "/echanges?offre=", "/succes#"]) {
    assert.match(source, new RegExp(href.replace("?", "\\?")));
  }
});
