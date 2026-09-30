import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
      if (name.startsWith("@/")) {
        const modulePath = name.slice(2);
        const relative = ["tsx", "ts"].map(extension => `${modulePath}.${extension}`).find(candidate => existsSync(path.join(root, candidate)));
        if (!relative) throw new Error(`Module local introuvable : ${name}`);
        return load(relative);
      }
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
  assert.match(modal, /onClose=\{\(\) => \{ if \(open\) onClose\(\); \}\}/);
  assert.match(collection, /open=\{!!selected&&!discardConfirm&&!auctionOpen\}/);
  assert.match(collection, /open=\{auctionOpen&&!!selected\}/);
});

test("la destruction multiple est active et transmet tous les exemplaires sélectionnés", () => {
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(collection, /onDiscardMany\(selectedCards\.map\(card => card\.instanceId\)\)/);
  assert.match(collection, /bulkDiscardBusy\?"Destruction…":"Détruire la sélection"/);
  assert.doesNotMatch(collection, /Destruction bientôt disponible/);
  assert.ok(collection.indexOf('className="yk-selection-bar"') > collection.indexOf('className="yk-collection-grid"'));
  assert.match(styles.match(/\.yk-selection-bar \{[^}]+\}/)?.[0] ?? "", /position:\s*sticky/);
  assert.match(styles.match(/\.yk-selection-bar \{[^}]+\}/)?.[0] ?? "", /bottom:\s*var\(--layout-gutter-compact\)/);
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

test("le catalogue reprend la sidebar sans notion de possession ni action de masse", () => {
  const source = readFileSync(path.join(root, "components/community-views.tsx"), "utf8");
  const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "styles/community.css"), "utf8");
  const catalogue = source.slice(source.indexOf("export function SearchView"), source.indexOf("export function TradesView"));
  assert.match(catalogue, /yk-collection-sidebar/);
  assert.match(catalogue, /CatalogueFilterSection title="Rareté"/);
  assert.match(catalogue, /CatalogueFilterSection title="Catégorie"/);
  assert.match(catalogue, /<CardShell><YokaiCard/);
  assert.match(catalogue, /CARD_PAGE_SIZES\.map/);
  assert.match(catalogue, /loadPage\(\{query,category,rarity,page,pageSize\}\)[^]*?\[query,category,rarity,page,pageSize,loadPage\]/);
  assert.match(catalogue, /Possesseurs actuels/);
  assert.match(catalogue, /Ajouter à ma wishlist/);
  assert.doesNotMatch(catalogue, /Dossier|Sélection multiple|Obtenue le|possédée/);
  assert.match(layout, /styles\/community\.css/);
  assert.match(layout, /styles\/collection\.css/);
  assert.match(catalogue, /className="yk-card-grid yk-catalogue-grid"/);
  assert.match(styles, /\.yk-catalogue-card \{[^}]*width: 100%/);
});

test("mobile : vitrine du profil sur la grille partagée et page Amis sans débordement", () => {
  const profile = readFileSync(path.join(root, "components/profile.tsx"), "utf8");
  const community = readFileSync(path.join(root, "styles/community.css"), "utf8");
  assert.match(profile, /className="yk-card-grid yk-featured-stage"/);
  assert.match(community, /\.yk-featured-stage \{ --card-grid-columns-xl: 4; --card-grid-columns-lg: 4; --card-grid-columns-md: 4;/);
  assert.doesNotMatch(community.match(/\.yk-featured-stage \{[^}]+\}/)?.[0] ?? "", /grid-template-columns/);
  // Grid children must be allowed to shrink, otherwise the non-wrapping tabs widen the page.
  assert.match(community, /\.yk-social-stack > \* \{ min-width: 0; \}/);
  assert.doesNotMatch(community, /\.yk-social-person \.yk-friend-action,[^{]*\{ width: 100%; margin-left/);
  const friends = readFileSync(path.join(root, "components/friends.tsx"), "utf8");
  assert.match(friends, /const liveFriendsPanel: FriendsPanelAdapter = \{ friendships: getFriendships, search: searchUsers, respond: respondFriendRequest \}/);
});

test("barre d'outils Collection compacte sur mobile et tiroir fermé même en mouvement réduit", () => {
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  const ui = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  // The filter trigger lives inside the toolbar so both collapse into two compact rows.
  assert.ok(collection.indexOf('className="yk-mobile-filter-trigger"') > collection.indexOf('<div className="yk-collection-toolbar">'));
  // Mobile: "Sélection multiple" becomes an icon; the label stays available to screen readers.
  assert.match(css, /\.yk-collection-toolbar \.yk-selection-mode-label \{ position: absolute;/);
  assert.match(collection, /className="yk-selection-mode" aria-pressed=\{selecting\}/);
  // The global reduced-motion reset drops transforms: the closed drawer and the Karas gem must keep theirs.
  assert.match(ui, /transform: none !important/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) and \(max-width: 760px\) \{ \.yk-collection-sidebar:not\(\.yk-sidebar-open\) \{ transform: translateX\(-100%\) !important; \} \}/);
  assert.match(ui, /\.yk-karas-gem \{ transform: rotate\(45deg\) !important; \}/);
});

test("Collection, Catalogue et Marché partagent une seule échelle de colonnes", () => {
  const ui = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  assert.match(ui, /\.yk-card-grid \{ display: grid; grid-template-columns: repeat\(var\(--card-grid-columns,var\(--card-grid-columns-xl\)\)/);
  assert.match(ui, /max-width: 760px\) \{ \.yk-card-grid \{ --card-grid-columns: var\(--card-grid-columns-sm\)/);
  assert.match(readFileSync(path.join(root, "components/collection.tsx"), "utf8"), /className=\{`yk-card-grid yk-collection-grid /);
  assert.match(readFileSync(path.join(root, "components/community-views.tsx"), "utf8"), /className="yk-card-grid yk-market-list"/);
  assert.match(readFileSync(path.join(root, "components/community-views.tsx"), "utf8"), /className="yk-card-grid yk-wishlist-grid"/);
  // No page may redefine its own column count for these grids (the 1280px :not() override broke mobile).
  for (const file of ["collection", "community", "market"]) {
    const css = readFileSync(path.join(root, `styles/${file}.css`), "utf8");
    assert.doesNotMatch(css, /\.yk-(?:collection-grid|catalogue-grid|market-list|wishlist-grid)(?::not\([^)]*\))? \{[^}]*grid-template-columns: repeat/);
  }
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
  assert.match(html, />SSR ×(?:<!-- -->)?1</);
  assert.doesNotMatch(html, />SSR ×(?:<!-- -->)?5</);
});

test("la collection pagine par multiples de 6 pour remplir la grille", () => {
  const { CollectionView } = load("components/collection.tsx");
  const cards = Array.from({ length: 30 }, (_, i) => ({ ...card, instanceId: `copy-${i}`, folderId: null }));
  const html = render(CollectionView, { cards, categories: [], folders: [], async onMoveCard() {}, async onCreateAuction() {}, async onEvolve() {}, async onSetCustomImage() {}, async onDiscard() {}, async onDiscardMany() {} });
  assert.equal((html.match(/class="yk-collection-card[ "]/g) || []).length, 24);
  assert.match(html, /<option value="24"[^>]*>24<\/option><option value="36"[^>]*>36<\/option><option value="48"[^>]*>48<\/option>/);
  assert.doesNotMatch(html, /Cartes par page \(non disponible/);
});

test("Phase 5 : habillage des boosters sans toucher au reveal", () => {
  const { BoosterReveal, Boosters } = load("components/boosters.tsx");
  const cards = Array.from({ length: 5 }, (_, i) => ({ ...card, instanceId: `copy-${i}`, anime: "Spirit Realm" }));
  const regular = render(BoosterReveal, { cards, revealed: 2, onReveal() {}, onReturn() {}, async onDiscard() {} });
  assert.equal((regular.match(/>Détruire</g) || []).length, 2);
  assert.match(regular, /<button[^>]*disabled=""[^>]*>Ajouter à ma collection</);
  const regularDone = render(BoosterReveal, { cards, revealed: 5, onReveal() {}, onReturn() {}, async onDiscard() {} });
  assert.match(regularDone, /href="\/collection"[^>]*>Ajouter à ma collection</);
  const choosing = render(BoosterReveal, { cards, revealed: 5, onReveal() {}, onReturn() {}, decision: { async onKeep() { return 0; } } });
  assert.equal((choosing.match(/>Garder celle-ci</g) || []).length, 5);
  assert.doesNotMatch(choosing, />Détruire</);
  const selection = render(Boosters, {
    status: { available: 0, maximum: 5, nextPackAt: Date.now() + 60_000 }, countdown: "01:00",
    decisionStatus: { available: false, pending: [], nextPackAt: new Date().setHours(24, 30, 0, 0) }, decisionCountdown: "10:00:00",
    busy: false, draw: [], drawKind: "regular", collection: [], revealed: 0,
    async onOpen() {}, async onKeepDecision() { return 0; }, async onDiscard() {}, onReveal() {},
  });
  assert.match(selection, /0\/5 en réserve/);
  assert.match(selection, /Prochain dans 01:00/);
  assert.match(selection, /1 carte à garder parmi 5/);
  assert.match(selection, /Revient demain à 00:30/);
  const source = readFileSync(path.join(root, "components/boosters.tsx"), "utf8");
  assert.match(source, /Garder cette carte et perdre les \{cards\.length - 1\} autres \?/);
});

test("la modale de détail groupe dossier sous la carte et destruction explicite en bas", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const modal = source.slice(source.indexOf('title="Détail de la carte"'), source.indexOf('title="Détruire cette carte ?"'));
  assert.ok(modal.indexOf("yk-detail-art") < modal.indexOf("yk-detail-folder"));
  assert.ok(modal.indexOf("yk-detail-folder") < modal.indexOf("yk-detail-info"));
  assert.ok(modal.indexOf("yk-detail-actions") < modal.indexOf("yk-detail-image"));
  assert.ok(modal.indexOf("yk-detail-image") < modal.indexOf("yk-detail-danger"));
  assert.match(modal, /Détruire la carte \(\+\{DESTRUCTION_KARAS\[selected\.rarity\]\}/);
  assert.match(modal, /Revenir à l’image d’origine/);
  assert.match(modal, /selectedMeta\?\.marketValue!=null&&/);
  assert.doesNotMatch(modal, /aria-label=\{`Détruire \$\{selected\.name\}`\}/);
  assert.match(source, /setDiscardConfirm\(true\)/);
});

test("la mise en vente suggère la valeur de marché sans remplacer le prix par défaut", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /loadCardDiscovery = getCardDiscovery/);
  assert.match(source, /await loadCardDiscovery\(selected\.id\)/);
  assert.match(source, /setAuctionPrice\("10"\)/);
  assert.match(source, /value!=null&&Number\.isFinite\(value\)&&value>0/);
  assert.match(source, /Suggestion : <Karas amount=\{auctionSuggestion\}/);
  assert.match(source, /onClick=\{\(\)=>setAuctionPrice\(String\(auctionSuggestion\)\)\}>Utiliser cette valeur/);
  const proof = readFileSync(path.join(root, "components/auction-suggestion-proof.tsx"), "utf8");
  assert.match(proof, /marketValue: disabled \? null : 240/);
  const preview = readFileSync(path.join(root, "app/design-system/auction-suggestion-preview/page.tsx"), "utf8");
  assert.match(preview, /\(await searchParams\)\.disabled === "1"/);
});

test("Phase 6 : liste du marché, suivi et Mes enchères", () => {
  const { MarketView } = load("components/community-views.tsx");
  const auction = (id, extra = {}) => ({ id, card: { ...card, id: `card-${id}` }, amount: 120, remaining: "00:12:00", remainingSeconds: 720, seller: "Kitsune", bids: 3, ...extra });
  const lists = { active: [auction("a", { wishlist: true }), auction("b", { remainingSeconds: 120, remaining: "00:02:00" })], mine: [], won: [], sold: [] };
  const html = render(MarketView, { lists, activeSales: "0", async onToggleWatch() {} });
  assert.equal((html.match(/class="yk-market-tile"/g) || []).length, 2);
  assert.match(html, /aria-pressed="true"[^>]*aria-label="Ne plus suivre cette enchère"[^>]*>.*?<span class="yk-watch-label">Suivi<\/span>/);
  assert.match(html, /aria-pressed="false"[^>]*aria-label="Suivre cette enchère"[^>]*>.*?<span class="yk-watch-label">Suivre<\/span>/);
  assert.match(html, /yk-market-timer yk-urgency-critical/);
  assert.match(html, /<aside id="market-filters" class="yk-collection-sidebar /);
  assert.match(html, /id="market-query" type="search"/);
  assert.match(html, /aria-pressed="true"><span class="yk-filter-check"><\/span><span>Fin imminente<\/span>/);
  assert.match(html, /<span>Prix croissant<\/span>.*<span>Prix décroissant<\/span>/);
  assert.match(html, /aria-controls="market-filters"/);
  const search = render(MarketView, { lists: { ...lists, active: [auction("l", { card: { ...card, id: "l", name: "Luffy", anime: "One Piece", category: "Manga" } }), auction("z", { card: { ...card, id: "z", name: "Zoro", anime: "One Piece", category: "Manga" } })] } });
  assert.match(search, /2 cartes aux enchères/);
  assert.match(search, /<span>Manga<\/span>/);
  assert.match(html, /disabled="" aria-describedby="market-popular-soon"><span class="yk-filter-check"><\/span><span>Les \+ populaires<\/span>/);
  assert.match(html, />Mes enchères</);
  const source = readFileSync(path.join(root, "components/community-views.tsx"), "utf8");
  assert.match(source, /matchesCardSearch\(query,\[a\.card\.name,a\.card\.anime\]\)/);
  assert.doesNotMatch(source, /terms\.every|const terms=/);
  assert.match(source, /\[\["mine","En cours"\],\["won","Gagnées"\],\["sold","Terminées"\]\]/);
  assert.doesNotMatch(source, /"Vendues"/);
  // One sidebar for both tabs; Mes enchères swaps the price sort for a Statut section.
  assert.match(source, /\{section==="mine"&&<CatalogueFilterSection title="Statut">/);
  assert.match(source, /\{section==="browse"&&<CatalogueFilterSection title="Trier par">/);
  // Same layout as Collection/Catalogue: the sidebar stays in normal page flow without its own scroll area.
  assert.match(source, /<div className="yk-collection-layout">\s*<aside id="market-filters"/);
  assert.match(source, /className="yk-market-filter-scroll"/);
  assert.match(source, /className="yk-collection-toolbar yk-market-toolbar-band"/);
  const marketCss = readFileSync(path.join(root, "styles/market.css"), "utf8");
  const collectionCss = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  assert.doesNotMatch(collectionCss, /\.yk-collection-sidebar \{[^}]*position: sticky/);
  assert.doesNotMatch(marketCss, /\.yk-market-filter-scroll \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(marketCss, /\.yk-market-sidebar \{[^}]*max-height:/);
});

test("la recherche du marché filtre en mémoire par nom et franchise", () => {
  const source = readFileSync(path.join(root, "components/community-views.tsx"), "utf8");
  assert.match(source, /const \[query,setQuery\]=useState\(""\)/);
  assert.match(source, /matchesCardSearch\(query,\[a\.card\.name,a\.card\.anime\]\)/);
  assert.match(source, /&&\(!rarity\|\|a\.card\.rarity===rarity\)/);
  assert.match(source, /id="market-query" type="search" value=\{query\}/);
  assert.match(source, /Aucune enchère ne correspond à votre recherche et vos filtres/);
  assert.ok(existsSync(path.join(root, "app/design-system/market-search-preview/page.tsx")));
});

test("la recherche multi-termes partage une sémantique ET entre Collection, Catalogue et Marché", () => {
  const { cardSearchTerms, matchesCardSearch } = load("lib/ui/card-search.ts");
  assert.deepEqual([...cardSearchTerms("  LUFFY, One PIECE ")], ["luffy", "one", "piece"]);
  assert.equal(matchesCardSearch("one piece luffy", ["Monkey D. Luffy", "One Piece"]), true);
  assert.equal(matchesCardSearch("LUFFY ONE PIECE", ["Monkey D. Luffy", "One Piece"]), true);
  assert.equal(matchesCardSearch("one piece naruto", ["Monkey D. Luffy", "One Piece"]), false);
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const community = readFileSync(path.join(root, "components/community-views.tsx"), "utf8");
  const cards = readFileSync(path.join(root, "lib/data/cards.ts"), "utf8");
  assert.match(collection, /matchesCardSearch\(query,\[c\.name,c\.category,c\.anime\]\)/);
  assert.match(community, /matchesCardSearch\(query,\[a\.card\.name,a\.card\.anime\]\)/);
  assert.match(cards, /for \(const term of cardSearchTerms\(query\)\) request = request\.or/);
  assert.ok(existsSync(path.join(root, "app/design-system/multi-term-search-preview/page.tsx")));
});

test("Phase 6 : détail d'enchère, solde, minute ajoutée, historique et issues", () => {
  const { AuctionView, presentAuction } = load("components/community-views.tsx");
  const base = { id: "a", card: { ...card, anime: "Spirit Realm" }, amount: 120, remaining: "00:04:00", remainingSeconds: 240, seller: "Kitsune", bids: 2, nextBid: 130, minimumBid: 130, balance: 100, extended: true,
    history: [{ id: "h1", name: "Oni", amount: 120, time: "14:32" }, { id: "h2", name: "Moi", amount: 110, time: "14:30", mine: true }] };
  const live = render(AuctionView, { auction: base, async onBid() {} });
  assert.match(live, />\+10 Karas<span>· 130 Karas<\/span>/);
  assert.match(live, /Une minute a été ajoutée à l’enchère\./);
  assert.match(live, /Solde de Karas insuffisant \(ton solde : 100 Karas\)/);
  assert.match(live, /Oni<\/a><span class="text-ink-3"> · <\/span><span class="text-karas tabular-nums">120 Karas<\/span><span class="text-ink-3"> · <\/span><time[^>]*>14:32<\/time>/);
  assert.ok(live.indexOf("yk-auction-history") > live.indexOf("yk-auction-panel"));
  assert.match(render(AuctionView, { auction: { ...base, finished: true, status: "won" } }), /Enchère remportée !/);
  assert.match(render(AuctionView, { auction: { ...base, finished: true, status: "lost", winner: "Oni" } }), /Enchère perdue[^]*Remportée par Oni/);
  const raw = { id: "a", card, amount: 120, endsAt: new Date(Date.now() + 60_000).toISOString(), status: "active", seller: "Kitsune", sellerId: "s", buyerId: "x", bids: 2, watched: false, balance: 50,
    history: [{ id: "h1", name: "Oni", amount: 120, createdAt: "2026-09-29T12:32:00Z", mine: false }, { id: "h2", name: "Moi", amount: 110, createdAt: "2026-09-29T12:30:00Z", mine: true }] };
  assert.equal(presentAuction(raw, "me").status, "outbid");
  assert.equal(presentAuction({ ...raw, status: "sold" }, "me").status, "lost");
  assert.equal(presentAuction({ ...raw, status: "sold", buyerId: "me" }, "me").status, "won");
  assert.match(presentAuction(raw, "me").history[0].time, /^\d{2}:\d{2}$/);
});

test("Phase 6 : la mise en vente confirme le verrouillage et signale la réinitialisation d'image", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /Carte mise aux enchères — verrouillée jusqu’à la fin de la vente/);
  assert.match(source, /selected\.customImageUrl&&<li>L’image personnalisée de cette carte sera réinitialisée\.<\/li>/);
  assert.match(source, /\[\["15","15 min"\],\["30","30 min"\],\["60","1 h"\],\["240","4 h"\],\["720","12 h"\],\["1440","24 h"\]\]/);
  assert.match(source, /useState\("10"\)/);
});

test("l’inscription vérifie le pseudo après debounce sans remplacer la validation de soumission", () => {
  const form = readFileSync(path.join(root, "components/auth-form.tsx"), "utf8");
  assert.match(form, /window\.setTimeout\(async \(\) => \{/);
  assert.match(form, /\}, 450\)/);
  assert.match(form, /pseudoValidationError\(pseudo\.trim\(\)\)/);
  assert.match(form, /pseudoRequest\.current \+= 1/);
  assert.match(form, /if \(pseudoRequest\.current !== request\) return/);
  assert.match(form, /Disponible/);
  assert.match(form, /Déjà pris/);
  assert.doesNotMatch(form, /disabled=\{[^}]*pseudoAvailability/);
  const actions = readFileSync(path.join(root, "app/auth/actions.ts"), "utf8");
  assert.match(actions, /export async function checkPseudoAvailabilityWhileTyping/);
  assert.match(actions, /return await checkPseudoAvailability\(supabase, cleanPseudo\)/);
  assert.match(actions, /export async function signUp[\s\S]*const pseudoAvailable = await checkPseudoAvailability\(supabase, input\.pseudo\)/);
});

test("le résumé d’un booster redirige vers la Collection et annule le délai sur les actions", () => {
  const source = readFileSync(path.join(root, "components/boosters.tsx"), "utf8");
  assert.match(source, /window\.setTimeout\(redirectToCollection, 3000\)/);
  assert.match(source, /return cancelCollectionRedirect/);
  assert.match(source, /navigateToCollection=\{\(\) => router\.push\("\/collection"\)\}/);
  assert.match(source, /onClick=\{\(\) => \{ cancelCollectionRedirect\(\); onNext\(\); \}\}/);
  assert.match(source, /href="\/collection" onClick=\{cancelCollectionRedirect\}/);
  assert.match(source, /Redirection vers la Collection dans 3 secondes/);
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

test("les notifications se relisent à l'ouverture du panneau et au retour sur l'onglet", () => {
  const hook = readFileSync(path.join(root, "hooks/use-notification-feed.ts"), "utf8");
  const topbar = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  const community = readFileSync(path.join(root, "components/community-views.tsx"), "utf8");
  assert.match(hook, /setInterval\(\(\) => void refresh\(\), POLL_INTERVAL_MS\)/);
  assert.match(hook, /addEventListener\("visibilitychange"/);
  assert.match(hook, /removeEventListener\("visibilitychange"/);
  assert.match(hook, /inFlight\.current\) return/);
  assert.match(topbar, /setPanel\("notifications"\);if\(notifications\)onRefreshNotifications\?\.\(\);else void feed\.refresh\(\);/);
  assert.match(community, /onRefreshNotifications=\{\(\)=>void feed\.refresh\(\)\}/);
  for (const source of [topbar, community]) assert.doesNotMatch(source, /getNotifications\(\)/);
  assert.ok(existsSync(path.join(root, "app/design-system/notification-refresh-preview/page.tsx")));
});

test("tri de la Collection : rareté par défaut, dates, nom français et ordre stable", () => {
  const { sortCollection, COLLECTION_SORTS, DEFAULT_COLLECTION_SORT, isCollectionSort } = load("lib/ui/collection-sort.ts");
  const make = (instanceId, name, rarity, shiny, obtainedAt) => ({ ...card, instanceId, name, rarity, shiny, obtainedAt });
  const cards = [make("a", "Écho", "SR", false, "2026-03-01T10:00:00Z"), make("b", "akira", "LR", false, "2026-01-15T10:00:00Z"), make("c", "Zorro", "SSR", true, "2026-05-10T10:00:00Z"), make("d", "Mochi", "SSR", false, "2026-05-10T10:00:00Z"), make("e", "Bashō", "C", false, "2026-07-01T10:00:00Z"), make("f", "Kitsune", "R", true, "2025-12-31T10:00:00Z")];
  const names = sort => sortCollection(cards, sort).map(item => item.name).join(",");
  assert.equal(DEFAULT_COLLECTION_SORT, "rarity");
  assert.equal(COLLECTION_SORTS.map(option => option.label).join(" | "), "Rareté | Plus récentes | Plus anciennes | Nom (A → Z)");
  assert.equal(names("rarity"), "akira,Zorro,Mochi,Écho,Kitsune,Bashō");
  assert.equal(names("recent"), "Bashō,Zorro,Mochi,Écho,akira,Kitsune");
  assert.equal(names("oldest"), "Kitsune,akira,Écho,Zorro,Mochi,Bashō");
  assert.equal(names("name"), "akira,Bashō,Écho,Kitsune,Mochi,Zorro");
  assert.equal(cards[0].name, "Écho", "le tri ne modifie pas le tableau reçu");
  const twins = [make("z", "Double", "C", false, "2026-01-01T00:00:00Z"), make("y", "Double", "C", false, "2026-01-01T00:00:00Z")];
  assert.equal(sortCollection(twins, "name").map(item => item.instanceId).join(), "y,z");
  assert.ok(isCollectionSort("oldest")); assert.ok(!isCollectionSort("franchise")); assert.ok(!isCollectionSort(null));
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /sortCollection\(cards\.filter\(/);
  assert.match(source, /setSort\(e\.target\.value\);setPage\(1\);/);
  assert.doesNotMatch(source, /yk-sort-placeholder|Tri non disponible/);
  const css = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  assert.match(css, /\.yk-sort-control \{[^}]*white-space: nowrap;/, "les libellés longs restent sur une ligne");
  assert.match(css, /\.yk-collection-toolbar-actions > \* \{[^}]*width: calc\(var\(--spacing\) \* 50\);/, "la largeur partagée des actions ne change pas");
});
