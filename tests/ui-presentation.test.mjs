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
  assert.match(collection, /open=\{!!selected&&!discardConfirm&&!auctionOpen&&!evolveConfirm\}/);
  assert.match(collection, /open=\{auctionOpen&&!!selected\}/);
});

test("la destruction multiple est active et transmet tous les exemplaires sélectionnés", () => {
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const controls = readFileSync(path.join(root, "components/ui/index.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(collection, /onDiscardMany\(selectedCards\.map\(card => card\.instanceId\)\)/);
  assert.match(controls, /busy\?"Destruction…":"Détruire la sélection"/);
  assert.doesNotMatch(collection, /Destruction bientôt disponible/);
  assert.ok(collection.indexOf('<SelectionBar') > collection.indexOf('className={`yk-card-grid yk-collection-grid'));
  assert.match(styles.match(/\.yk-selection-bar \{[^}]+\}/)?.[0] ?? "", /position:\s*sticky/);
  assert.match(styles.match(/\.yk-selection-bar \{[^}]+\}/)?.[0] ?? "", /bottom:\s*var\(--layout-gutter-compact\)/);
  assert.match(game, /onDiscardMany=\{discardCollectionCards\}/);
  assert.match(collection, /presentation\[card\.instanceId\]\?\.destructionValue\?\?DESTRUCTION_KARAS\[card\.rarity\]/);
  assert.doesNotMatch(collection, /const valueKnown = selectedCards/);
});

test("la collection d'un ami montre ses images personnalisées sans proposer d'édition", () => {
  const { CollectionView } = load("components/collection.tsx");
  const html = render(CollectionView, { cards: [{...card,image:"https://i.imgur.com/private.png",catalogueImage:"/catalogue.png"}], categories: ["Test"], readOnly: true });
  assert.match(html, /Carte de test/);
  assert.match(html, /private\.png/);
  assert.doesNotMatch(html, /Sélection multiple|Détruire la sélection|Modifier le profil/);
});

test("le compteur de cartes d'un ami ouvre sa collection complète en lecture seule", () => {
  const profile = readFileSync(path.join(root, "components/profile.tsx"), "utf8");
  const communityCss = readFileSync(path.join(root, "styles/community.css"), "utf8");
  assert.match(profile, /profile\.friendshipStatus==="accepted"\?<button/);
  assert.match(profile, /getFriendCollection\(friendId\)/);
  assert.match(profile, /<CollectionView cards=\{friendCards\} categories=\{categories\} readOnly\/>/);
  assert.match(profile, /Voir la collection/);
  assert.match(profile, /className="yk-friend-collection-modal"/);
  assert.match(communityCss, /\.yk-modal\.yk-friend-collection-modal \{ width: min\(1400px,calc\(100% - 32px\)\); \}/);
});

test("une carte d'ami ouvre une proposition d'échange présélectionnée et extensible", () => {
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const trades = readFileSync(path.join(root, "components/trades.tsx"), "utf8");
  const community = readFileSync(path.join(root, "components/community-views.tsx"), "utf8");
  assert.match(collection, /\/echanges\?ami=.*&carte=/);
  assert.match(collection, /Proposer un échange/);
  assert.match(community, /initialRequestedCardId=\{searchParams\.get\("carte"\)/);
  assert.match(trades, /setRequested\(new Set\(\[initialRequestedCardId\]\)\)/);
  assert.match(trades, /function toggle\(current: Set<string>/);
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

test("le sélecteur de cartes mises en avant recherche et remonte la sélection", () => {
  const source = readFileSync(path.join(root, "components/profile.tsx"), "utf8");
  assert.match(source, /id="featured-query"/);
  assert.match(source, /matchesCardSearch\(featuredQuery/);
  assert.match(source, /Number\(selected\.has\(b\.instanceId\)\)-Number\(selected\.has\(a\.instanceId\)\)/);
});

test("le profil invalide l’avatar partagé et la Topbar le recharge", () => {
  const profile = readFileSync(path.join(root, "lib/data/profile.ts"), "utf8");
  const topbar = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  assert.match(profile, /publishPlayerSnapshotInvalidation\(\["profile"\]\)/);
  assert.match(topbar, /refreshAvatar\(\);const unsubscribe/);
  assert.match(topbar, /scopes\.includes\("profile"\)/);
  assert.match(topbar, /image=\{avatarUrl\}/);
});

test("l’avatar ouvre un menu profil compact avec résumé et actions", () => {
  const topbar = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  const account = readFileSync(path.join(root, "components/account-menu.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/topbar.css"), "utf8");
  assert.match(topbar, /aria-label="Ouvrir mon compte"/);
  assert.match(topbar, /panel==="account"/);
  assert.match(topbar, /className="yk-account-panel"/);
  assert.match(topbar, />Voir mon profil<\/Link>/);
  assert.match(topbar, />Paramètres<\/Link>/);
  assert.match(topbar, />Mes succès<\/Link>/);
  assert.doesNotMatch(topbar, /aria-current=\{view === "achievements"/);
  assert.match(topbar, /toLocaleString\("fr-FR"\).*Karas/);
  assert.match(topbar, /className="yk-account-karas"/);
  assert.doesNotMatch(topbar, /yk-mobile-account/);
  assert.ok(topbar.indexOf('href="/wishlist"') < topbar.indexOf('href="/recherche" aria-current'));
  assert.match(topbar, /document\.addEventListener\("pointerdown",closeOnOutsidePointer\)/);
  assert.match(topbar, /closest\(`#\$\{panelId\},\[aria-controls=/);
  assert.doesNotMatch(topbar, /Gère ton profil et ta session/);
  assert.doesNotMatch(topbar, />Fermer<\/button>/);
  assert.doesNotMatch(topbar, /<Modal open=\{panel === "account"\}/);
  assert.match(account, /<SignOutButton \/>/);
  assert.match(css, /width: min\(280px/);
  assert.match(css, /background: #0f0c1d/);
  assert.match(css, /box-shadow: 0 12px 32px -4px rgba\(4,0,11,\.95\)/);
  assert.match(css, /\.yk-account-karas \{ display: none; \}/);
  assert.match(css, /max-width: 620px[^]*\.yk-account-karas \{ display: block; \}/);
});

test("la destruction groupée demande une confirmation chiffrée", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /setBulkDiscardConfirm\(true\)/);
  assert.match(source, /Action irréversible\./);
  assert.match(source, /selectedCards\.length/);
  assert.match(source, /selectedValue\?\?"…"/);
});

test("barre d'outils Collection compacte sur mobile et tiroir fermé même en mouvement réduit", () => {
  const collection = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  const ui = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  // The filter trigger lives inside the toolbar so both collapse into two compact rows.
  assert.ok(collection.indexOf('className="yk-mobile-filter-trigger"') > collection.indexOf('<div className="yk-collection-toolbar">'));
  // Mobile: "Sélection multiple" becomes an icon; the label stays available to screen readers.
  assert.match(css, /\.yk-collection-toolbar \.yk-selection-mode-label \{ position: absolute;/);
  assert.match(collection, /<SelectionModeButton active=\{selecting\}/);
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

test("la collection annonce l'évolution de cinq SSR non-Shiny en Shiny", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /Évolution Shiny/);
  assert.match(source, /Évoluer en Shiny \(\{evolvableCopies\}\/5\)/);
  assert.doesNotMatch(source, /Évolution LR|Évoluer en LR/);
  assert.match(source, /Confirmer l’évolution Shiny/);
  assert.match(source, /Image : \{card\.customImageUrl\?"personnalisée \(sera perdue\)":"d’origine"\}/);
  assert.match(source, /onEvolve\(evolutionCards\.map\(card=>card\.instanceId\)\)/);
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
  const cards = Array.from({ length: 30 }, (_, i) => ({ ...card, id: `card-${i}`, instanceId: `copy-${i}`, folderId: null }));
  const html = render(CollectionView, { cards, categories: [], folders: [], async onMoveCard() {}, async onCreateAuction() {}, async onEvolve() {}, async onSetCustomImage() {}, async onDiscard() {}, async onDiscardMany() {} });
  assert.equal((html.match(/class="yk-collection-card[ "]/g) || []).length, 24);
  assert.match(html, /<option value="24"[^>]*>24<\/option><option value="36"[^>]*>36<\/option><option value="48"[^>]*>48<\/option>/);
  assert.doesNotMatch(html, /Cartes par page \(non disponible/);
});

test("les copies normales et Shiny forment des tuiles distinctes avec badge de quantité", () => {
  const { CollectionView } = load("components/collection.tsx");
  const copies = [
    {...card,instanceId:"normal-1",folderId:null,shiny:false},
    {...card,instanceId:"normal-2",folderId:"favorites",shiny:false,customImageUrl:"https://i.imgur.com/custom.png",image:"/custom.png"},
    {...card,instanceId:"shiny-1",folderId:null,shiny:true},
  ];
  const html=render(CollectionView,{cards:copies,categories:[],folders:[{id:"favorites",name:"Favoris"}],async onDiscardMany(){},async onEvolve(){}});
  assert.equal((html.match(/class="yk-collection-card[ "]/g)||[]).length,2);
  assert.match(html,/×(?:<!-- -->)?2/);
  assert.doesNotMatch(html,/×(?:<!-- -->)?1/);
  assert.match(html,/custom\.png/);
});

test("Phase 5 : habillage des boosters sans toucher au reveal", () => {
  const { BoosterReveal, Boosters } = load("components/boosters.tsx");
  const cards = Array.from({ length: 5 }, (_, i) => ({ ...card, instanceId: `copy-${i}`, anime: "Spirit Realm" }));
  const regular = render(BoosterReveal, { cards, revealed: 2, onReveal() {}, onReturn() {}, async onDiscard() {} });
  assert.equal((regular.match(/>Défausser</g)||[]).length,2);
  assert.doesNotMatch(regular, />Sélectionner</);
  assert.match(regular, /<button[^>]*disabled=""[^>]*>Ajouter à ma collection</);
  const regularDone = render(BoosterReveal, { cards, revealed: 5, onReveal() {}, onReturn() {}, async onDiscard() {} });
  assert.match(regularDone, /href="\/collection"[^>]*>Ajouter à ma collection</);
  assert.match(regularDone, />Sélectionner</);
  assert.equal((regularDone.match(/>Défausser</g)||[]).length,5);
  const choosing = render(BoosterReveal, { cards, revealed: 5, onReveal() {}, onReturn() {}, decision: { async onKeep() { return 0; } } });
  assert.equal((choosing.match(/>Garder celle-ci</g) || []).length, 5);
  assert.doesNotMatch(choosing, /yk-slot-button">Défausser/);
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
  const boosterStyles = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(source, /Garder cette carte et perdre les \{cards\.length - 1\} autres \?/);
  assert.match(boosterStyles,/\.yk-reveal-selection-mode \{[^}]*width: auto;[^}]*min-height: 32px;/);
  assert.match(boosterStyles,/@media \(max-width: 40rem\) \{[\s\S]*\.yk-reveal-progress \{ grid-column: 1; grid-row: 2; justify-self: start; \}[\s\S]*\.yk-reveal-selection-mode \{ grid-column: 2; grid-row: 2; \}/);
});

test("les boosters annoncent les gains autoritaires avant confirmation", () => {
  const { BoosterReveal } = load("components/boosters.tsx");
  const values=[1,2,3,4,5];
  const cards=values.map((destructionValue,i)=>({...card,instanceId:`copy-${i}`,destructionValue}));
  const regular=render(BoosterReveal,{cards,revealed:5,onReveal(){},onReturn(){},async onDiscard(){}});
  assert.match(regular,/>Sélectionner</);
  assert.doesNotMatch(regular,/Défausser \(\+/);
  const decision=render(BoosterReveal,{cards,revealed:5,onReveal(){},onReturn(){},decision:{async onKeep(){return 14;}}});
  assert.equal((decision.match(/>Garder celle-ci</g)||[]).length,5);
  assert.doesNotMatch(decision,/Garder celle-ci \(\+/);
  const source=readFileSync(path.join(root,"components/boosters.tsx"),"utf8");
  assert.match(source,/selectedCards\.reduce\(\(sum,card\)=>sum\+card\.destructionValue!/);
  assert.match(source,/Tu recevras <strong className="text-karas">\{selectedValue\}/);
  assert.match(source,/if\(destroyingAll\)onReturn\(\)/);
  const migration=readFileSync(path.join(root,"supabase/migrations/20261001000002_booster_destruction_estimates.sql"),"utf8");
  assert.match(migration,/public\.card_destruction_value\(owned\.rarity\)/);
  assert.match(migration,/sum\(public\.card_destruction_value\(other_choices\.rarity\)\)/);
  assert.doesNotMatch(migration,/reward\s*:=\s*case/);
  assert.ok(existsSync(path.join(root,"app/design-system/booster-karas-preview/page.tsx")));
});

test("une carte révélée peut être mise directement sur le marché", () => {
  const boosters = readFileSync(path.join(root, "components/boosters.tsx"), "utf8");
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(boosters, /Mettre cette carte sur le marché/);
  assert.match(boosters, /onAuction\(auctionCandidate\.instanceId,price,Number\(auctionDuration\)\)/);
  assert.match(boosters, /auctioned\.has\(card\.instanceId\)\?<StatusPill tone="info">EN VENTE/);
  assert.match(boosters, /visibleCards\.filter\(card=>!auctioned\.has\(card\.instanceId\)\)/);
  assert.match(game, /onAuction=\{auctionCard\}/);
});

test("la modale de détail groupe dossier sous la carte et destruction explicite en bas", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  const modal = source.slice(source.indexOf('title="Détail de la carte"'), source.indexOf('title="Détruire des exemplaires ?"'));
  assert.ok(modal.indexOf("yk-detail-art") < modal.indexOf("yk-detail-folder"));
  assert.ok(modal.indexOf("yk-detail-folder") < modal.indexOf("yk-detail-info"));
  assert.ok(modal.indexOf("yk-detail-actions") < modal.indexOf("yk-detail-image"));
  assert.ok(modal.indexOf("yk-detail-image") < modal.indexOf("yk-detail-danger"));
  assert.match(modal, /Détruire des exemplaires/);
  assert.match(modal, /Revenir à l’image d’origine/);
  assert.match(modal, /selectedMeta\?\.marketValue!=null&&/);
  assert.doesNotMatch(modal, /aria-label=\{`Détruire \$\{selected\.name\}`\}/);
  assert.match(source, /setDiscardConfirm\(true\)/);
  assert.match(source, /setDiscardQuantity\(destructibleCards\.length\)/);
  assert.match(source, /\{discardValue\} Kara/);
});

test("la Collection groupe les tuiles et sélectionne tous les exemplaires disponibles", () => {
  const source = readFileSync(path.join(root, "components/collection.tsx"), "utf8");
  assert.match(source, /const groups = groupCollection\(filtered\)/);
  assert.match(source, /visibleGroups\.map\(group=>/);
  assert.match(source, /group\.cards\.length>1&&<span[^>]*>×\{group\.cards\.length\}/);
  assert.match(source, /toggleGroup\(group\.cards\)/);
  assert.match(source, /count=\{selectedCards\.length\}/);
  assert.match(source, /frozenCount>0/);
  assert.doesNotMatch(source, /Dernier exemplaire obtenu le/);
  assert.match(source, />Obtenu le <time dateTime=\{historyGroup\.firstObtainedAt\}>\{formatDate\(historyGroup\.firstObtainedAt\)\}<\/time>/);
  assert.match(source, /Premier propriétaire, obtenu le \{formatDate\(historyGroup\.firstObtainedAt\)\}/);
  assert.match(source, /yk-copy-picker/);
  assert.match(source, /itemLabel="exemplaire"/);
  assert.match(source, /toggleEvolutionCard/);
  assert.match(source, /Choisis précisément cinq exemplaires/);
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
  const auction = (id, extra = {}) => ({ id, card: { ...card, id: `card-${id}` }, amount: 120, remaining: "00:12:00", remainingSeconds: 720, seller: "Kitsune", sellerAvatarUrl: "https://cdn.example/kitsune.png", bids: 3, ...extra });
  const lists = { active: [auction("a", { wishlist: true }), auction("b", { remainingSeconds: 120, remaining: "00:02:00" })], mine: [], won: [], sold: [] };
  const html = render(MarketView, { lists, activeSales: "0", async onToggleWatch() {} });
  assert.equal((html.match(/class="yk-market-tile"/g) || []).length, 2);
  assert.match(html, /aria-pressed="true"[^>]*aria-label="Ne plus suivre cette enchère"[^>]*>.*?<span class="yk-watch-label">Suivi<\/span>/);
  assert.match(html, /https:\/\/cdn\.example\/kitsune\.png/);
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
  assert.match(html, /aria-pressed="false"><span class="yk-filter-check"><\/span><span>Les \+ populaires<\/span>/);
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

test("le Marché trie par favoris_count puis fin et identifiant", () => {
  const { compareMarketAuctions } = load("components/community-views.tsx");
  const auction=(id,popularity,remainingSeconds)=>({id,card,amount:100,remaining:"",remainingSeconds,seller:"",bids:0,popularity});
  const values=[auction("b",900,200),auction("z",120,50),auction("c",900,100),auction("a",900,100)];
  assert.deepEqual(values.toSorted((a,b)=>compareMarketAuctions(a,b,"popular")).map(item=>item.id),["a","c","b","z"]);
  const migration=readFileSync(path.join(root,"supabase/migrations/20261001000001_market_popularity.sql"),"utf8");
  assert.match(migration,/'popularity',coalesce\(c\.favoris_count,0\)/);
  assert.doesNotMatch(migration,/join public\.auction_watchers/);
  assert.ok(existsSync(path.join(root,"app/design-system/market-popularity-preview/page.tsx")));
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
  const ownSale = { ...base, bids: 0, nextBid: undefined, status: "mine" };
  assert.equal((render(AuctionView, { auction: ownSale, async onCancel() {} }).match(/Retirer la carte de la vente/g)??[]).length,2);
  const bidSale=render(AuctionView, { auction: { ...ownSale, bids: 1 }, async onCancel() {} });
  assert.equal((bidSale.match(/Retirer la carte de la vente/g)??[]).length,1);
  assert.match(bidSale, /ne peut plus être retirée car une mise a déjà été placée/);
  const raw = { id: "a", card, amount: 120, endsAt: new Date(Date.now() + 60_000).toISOString(), status: "active", seller: "Kitsune", sellerId: "s", buyerId: "x", bids: 2, watched: false, balance: 50,
    history: [{ id: "h1", name: "Oni", amount: 120, createdAt: "2026-09-29T12:32:00Z", mine: false }, { id: "h2", name: "Moi", amount: 110, createdAt: "2026-09-29T12:30:00Z", mine: true }] };
  assert.equal(presentAuction(raw, "me").status, "outbid");
  assert.equal(presentAuction({ ...raw, status: "sold" }, "me").status, "lost");
  assert.equal(presentAuction({ ...raw, status: "sold", buyerId: "me" }, "me").status, "won");
  assert.match(presentAuction(raw, "me").history[0].time, /^\d{2}:\d{2}$/);
});

test("Mes enchères conserve les participations surenchéries exposées par list_auctions", () => {
  const { buildAuctionLists, presentAuction } = load("components/community-views.tsx");
  const raw = { id:"outbid",card,amount:120,endsAt:new Date(Date.now()+60_000).toISOString(),status:"active",seller:"Kitsune",sellerId:"seller",buyerId:"rival",hasBid:true,bids:2,watched:false };
  assert.equal(presentAuction(raw,"viewer").status,"outbid");
  assert.deepEqual(buildAuctionLists([raw],"viewer").mine.map(item=>item.id),["outbid"]);
  assert.deepEqual(buildAuctionLists([{...raw,hasBid:false}],"viewer").mine,[]);
  const migration=readFileSync(path.join(root,"supabase/migrations/20261001000000_auction_participation.sql"),"utf8");
  assert.match(migration,/where b\.bidder_id=player_id/);
  assert.match(migration,/bids_bidder_auction_idx on public\.bids\(bidder_id,auction_id\)/);
  assert.ok(existsSync(path.join(root,"app/design-system/auction-participation-preview/page.tsx")));
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
