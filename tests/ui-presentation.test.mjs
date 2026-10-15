import { normalizeWhitespace } from "./helpers/normalize-whitespace.mjs";
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

test("les échanges réutilisent les cartes standard sans écraser leurs textes internes", () => {
  const source = readFileSync(path.join(root, "components/trades.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/community.css"), "utf8");
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /function OfferCards[\s\S]*?return <ReviewCards cards=\{cards\}\/>/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /<YokaiCard \{\.\.\.card\} image=\{card\.customImageUrl\?\?card\.image\}/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-trade-review-cards>div>div>span\s*\{/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-trade-review-cards\s+span\s*\{/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(source),
    normalizeWhitespace(/className="yk-offer-cards"/)
  );
});

test("la wishlist d'un ami se filtre par recherche, rareté et catégorie", () => {
  const source = readFileSync(
    path.join(root, "components/profile.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/function FriendWishlist/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /matchesCardSearch\(query,\[card\.name,card\.category,card\.anime\]\)/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/card\.rarity===rarity/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/card\.category===category/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/title="Rarity"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/title="Category"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Reset filters/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/<FriendWishlist cards=\{wishlist\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/shown\.map\(card=>\(?<Link[^>]+><CardShell><YokaiCard/)
  );
});
const modules = new Map();
function load(relative) {
  const filename = path.join(root, relative);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {};
  modules.set(filename, exports);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText;
  vm.runInNewContext(
    code,
    {
      exports,
      URL,
      process: { env: { NODE_ENV: "test" } },
      require: name => {
        if (name.endsWith(".css")) return {};
        if (name === "@/lib/data/cards")
          return {
            getAllCards() {
              assert.fail("Presentational server render must not load the API");
            },
            getUserCollection() {
              assert.fail("Presentational server render must not load the API");
            }
          };
        if (name === "@/components/ui") return load("components/ui/index.tsx");
        if (name.startsWith("@/")) {
          const modulePath = name.slice(2);
          const relative = (
            modulePath.endsWith(".mjs")
              ? [modulePath]
              : ["tsx", "ts"].map(extension => `${modulePath}.${extension}`)
          ).find(candidate => existsSync(path.join(root, candidate)));
          if (!relative) throw new Error(`Module local introuvable : ${name}`);
          return load(relative);
        }
        return require(name);
      }
    },
    { filename }
  );
  return exports;
}
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));

test("les routes consommatrices de MarketView ont exactement un h1 sans saut de niveau", async () => {
  for (const route of [
    "market-preview",
    "market-search-preview",
    "market-popularity-preview",
    "auction-participation-preview",
    "multi-term-search-preview"
  ]) {
    const page = load(`app/design-system/${route}/page.tsx`).default;
    const element = await page({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);
    const levels = [...html.matchAll(/<h([1-6])(?:\s|>)/g)].map(match =>
      Number(match[1])
    );
    assert.equal(levels.filter(level => level === 1).length, 1, route);
    let previous = 0;
    for (const level of levels) {
      assert.ok(level <= previous + 1, `${route}: h${previous} -> h${level}`);
      previous = level;
    }
  }
  const { MarketView } = load("components/community-views.tsx");
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(path.join(root, "app/marche/page.tsx"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX
      }
    }
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name =>
      name === "@/components/community-page"
        ? { CommunityPage: props => React.createElement(MarketView, props) }
        : require(name)
  });
  const html = renderToStaticMarkup(exports.default());
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  assert.match(
    readFileSync(
      path.join(root, "components/multi-term-search-proof.tsx"),
      "utf8"
    ),
    /<h2[^>]*>Marché<\/h2>/
  );
});

test("deleted avatars and auction participants render safely without profile links", () => {
  const { Avatar } = load("components/ui/index.tsx");
  assert.match(render(Avatar, { name: null }), /aria-label="Deleted player"/);
  const { AuctionView, presentAuction } = load(
    "components/community-views.tsx"
  );
  const auction = presentAuction(
    {
      id: "deleted",
      card,
      amount: 10,
      endsAt: "2026-10-10T00:00:00Z",
      status: "sold",
      seller: null,
      sellerId: null,
      buyerId: null,
      bids: 1,
      watched: false,
      balance: 100,
      winner: "Joueur supprimé",
      history: [
        {
          id: "bid",
          name: "Joueur supprimé",
          amount: 10,
          createdAt: "2026-10-09T00:00:00Z",
          mine: false
        }
      ]
    },
    "viewer"
  );
  const html = render(AuctionView, { auction });
  assert.match(html, /Joueur supprimé/);
  assert.doesNotMatch(html, /\/profil\/(?:Joueur|undefined|null)/);
});

test("offscreen avatars defer loading and decode asynchronously without losing their alt text", () => {
  const { Avatar } = load("components/ui/index.tsx");
  const html = render(Avatar, {
    name: "Player",
    image: "https://example.test/avatar.png",
    size: 32
  });
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /alt="Player"/);
  assert.match(html, /width="32"/);
  assert.match(html, /height="32"/);
});

test("route and root layout errors offer retry without exposing internal details", () => {
  for (const relative of ["app/error.tsx", "app/global-error.tsx"]) {
    assert.ok(
      existsSync(path.join(root, relative)),
      `${relative} doit prendre en charge les erreurs`
    );
    assert.match(
      readFileSync(path.join(root, relative), "utf8"),
      /^["']use client["']/
    );
    const ErrorPage = load(relative).default;
    let retries = 0;
    const props = {
      error: new Error("PRIVATE_DATABASE_DETAILS"),
      retry: () => {
        retries++;
      }
    };
    const html = render(ErrorPage, props);
    assert.match(html, /Unable to load this page/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /PRIVATE_DATABASE_DETAILS/);
    if (relative.includes("global-error")) {
      assert.match(html, /<html lang="en"/);
      assert.match(html, /<body/);
    }
    const buttons = [];
    function visit(node) {
      if (!React.isValidElement(node)) return;
      if (typeof node.type === "function") return visit(node.type(node.props));
      if (node.type === "button") buttons.push(node);
      React.Children.forEach(node.props.children, visit);
    }
    visit(ErrorPage(props));
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].props.type, "button");
    buttons[0].props.onClick();
    assert.equal(
      retries,
      1,
      "Le bouton doit relancer la récupération du segment"
    );
  }
});
const card = {
  id: "card-a",
  instanceId: "copy-a",
  name: "Carte de test",
  category: "Test",
  rarity: "SSR",
  image: "/test-image.png",
  obtainedAt: "2026-09-24T10:00:00Z"
};

test("les titres H1 utilisent la police locale HYWenHei-85W", () => {
  const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(
    normalizeWhitespace(layout),
    normalizeWhitespace(
      /localFont\(\{[\s\S]*HYWenHei-85W\.ttf[\s\S]*variable: "--font-hy-wen-hei"/
    )
  );
  assert.match(
    normalizeWhitespace(layout),
    normalizeWhitespace(/\$\{hyWenHei\.variable\}/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /--font-heading: var\(--font-hy-wen-hei\), Arial, sans-serif/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /h1 \{ font-family: var\(--font-heading\) !important; \}/
    )
  );
  assert.ok(
    existsSync(path.join(root, "app/fonts/hywenhei-85w/HYWenHei-85W.ttf"))
  );
});

test("la page d’accueil utilise le logo doré de la navigation", () => {
  const landing = readFileSync(path.join(root, "app/page.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/landing.css"), "utf8");
  assert.match(
    normalizeWhitespace(landing),
    normalizeWhitespace(/header-logo-gold\.png/)
  );
  assert.match(
    normalizeWhitespace(landing),
    normalizeWhitespace(/className="yk-landing-brand-image"/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-landing-brand \{ display: inline-flex; width: 112px;/
    )
  );
});

test("les pages d’authentification utilisent le nouveau logo doré", () => {
  const layout = readFileSync(path.join(root, "app/(auth)/layout.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/auth.css"), "utf8");
  assert.match(layout, /src="\/assets\/header-logo-gold\.png"/);
  assert.match(layout, /className="yk-auth-brand-image"/);
  assert.doesNotMatch(layout, /className="yk-auth-logo"/);
  assert.match(css, /\.yk-auth-brand-image\s*\{/);
});

test("la police HYWenHei remplace la police d'affichage sauf pour les noms sur les cartes", () => {
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const ui = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  const cards = readFileSync(path.join(root, "styles/cards.css"), "utf8");
  assert.match(
    css,
    /--font-display: var\(--font-hy-wen-hei\), Arial, sans-serif/
  );
  assert.match(
    ui,
    /--font-display: var\(--font-hy-wen-hei\), Arial, sans-serif/
  );
  assert.match(ui, /--font-card-name: var\(--font-cinzel\), Georgia, serif/);
  assert.match(
    cards,
    /\.yk-card-name \{[^}]*font-family: var\(--font-card-name\)/
  );
});

test("les nouveaux visuels distinguent le booster régulier du Decision Pack", () => {
  const boosters = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const cards = readFileSync(path.join(root, "styles/cards.css"), "utf8");
  const styles = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /src="\/assets\/booster-pack\.png" alt="Booster Régulier/
    )
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /src="\/assets\/decision-booster-pack\.png" alt="Booster Décisif/
    )
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /drawKind === "decision" \? "\/assets\/decision-booster-pack\.png" : "\/assets\/booster-pack\.png"/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(styles),
    normalizeWhitespace(/\.yk-decision-image \{[^}]*hue-rotate/)
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(
      /\.yk-decision-panel \.yk-pack-art-stage \{[^}]*var\(--color-karas\)/
    )
  );
  assert.match(
    normalizeWhitespace(cards),
    normalizeWhitespace(/url\(["']\/assets\/card-back\.png["']\)/)
  );
  assert.match(
    normalizeWhitespace(cards),
    normalizeWhitespace(
      /\.yk-card-back \{[^}]*background: #050507 url\(["']\/assets\/card-back\.png["']\)[^}]*color-accent-gold/
    )
  );
  for (const asset of [
    "card-back.png",
    "booster-pack.png",
    "decision-booster-pack.png"
  ])
    assert.ok(
      existsSync(path.join(root, "public/assets", asset)),
      `${asset} doit être présent`
    );
});

test("le verrou synchrone empêche deux ouvertures dans le même tick", async () => {
  const { runPackOpeningOnce } = load("lib/ui/pack-opening.ts");
  const lock = { current: false };
  let calls = 0;
  let release;
  const pending = new Promise(resolve => {
    release = resolve;
  });
  const openBooster = async () => {
    calls += 1;
    await pending;
  };
  const first = runPackOpeningOnce(lock, openBooster);
  const second = runPackOpeningOnce(lock, openBooster);
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  calls = 0;
  await Promise.all([openBooster(), openBooster()]);
  assert.equal(calls, 2, "contre-preuve sans verrou");
});

test("le verrou d'ouverture est libéré après une erreur serveur", async () => {
  const { runPackOpeningOnce } = load("lib/ui/pack-opening.ts");
  const lock = { current: false };
  await assert.rejects(
    runPackOpeningOnce(lock, async () => {
      throw new Error("session expirée");
    }),
    /session expirée/
  );
  assert.equal(lock.current, false);
  let retried = false;
  await runPackOpeningOnce(lock, async () => {
    retried = true;
  });
  assert.equal(retried, true);
});

test("la rupture attend la réponse et la tension minimale sans additionner leurs durées", async () => {
  const { runPackOpeningSequence } = load("lib/ui/pack-opening.ts");
  const events = [];
  let releaseResponse;
  let releaseTension;
  let releaseSeal;
  const response = new Promise(resolve => {
    releaseResponse = resolve;
  });
  const waits = new Map([
    [
      250,
      new Promise(resolve => {
        releaseTension = resolve;
      })
    ],
    [
      800,
      new Promise(resolve => {
        releaseSeal = resolve;
      })
    ]
  ]);
  const opening = runPackOpeningSequence({
    open: () => response,
    wait: duration => waits.get(duration),
    onResponse: () => events.push("response"),
    onSeal: () => events.push("seal")
  });

  releaseTension();
  await Promise.resolve();
  assert.equal(
    events.join(","),
    "",
    "contre-preuve : l'ancien minuteur pouvait finir avant le serveur"
  );
  releaseResponse([]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.join(","), "response,seal");
  releaseSeal();
  await opening;

  events.length = 0;
  let releaseFastTension;
  let releaseFastSeal;
  const fastOpening = runPackOpeningSequence({
    open: async () => [],
    wait: duration =>
      new Promise(resolve => {
        if (duration === 250) releaseFastTension = resolve;
        else releaseFastSeal = resolve;
      }),
    onResponse: () => events.push("response"),
    onSeal: () => events.push("seal")
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(
    events.join(","),
    "response",
    "une réponse rapide conserve les 250 ms de tension"
  );
  releaseFastTension();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.join(","), "response,seal");
  releaseFastSeal();
  await fastOpening;
});

test("l'ouverture centralise ses durées, se passe et ne bloque pas le reveal sur les rafraîchissements", () => {
  const animations = readFileSync(
    path.join(root, "lib/ui/animations.ts"),
    "utf8"
  );
  const boosters = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(
    normalizeWhitespace(animations),
    normalizeWhitespace(
      /packOpening:\s*\{ minimumTension: 250, tension: 400, seal: 800, fade: 150, slowResponse: 1500 \}/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/--pack-opening-tension-duration/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/--pack-opening-duration/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/--pack-opening-fade-duration/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-opening-tension \.yk-opening-pack \{ animation: none;/
    )
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(/matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(/event\.key==="Enter"\|\|event\.key===" "/)
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(/runPackOpeningSequence\(\{/)
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /Promise\.race\(\[decoding,[\s\S]*animation\.packOpening\.seal/
    )
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(/reducedMotion \? 0 : duration/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-opening-seal \.yk-opening-pack \{ animation: none;/
    )
  );
  assert.match(
    normalizeWhitespace(game),
    normalizeWhitespace(
      /setDraw\([\s\S]*?setBusy\(false\);[\s\S]*?void Promise\.all\(\[getPackStatus\(\)/
    )
  );
  assert.match(
    normalizeWhitespace(game),
    normalizeWhitespace(/runPackOpeningOnce\(opening/)
  );
});

test("Shiny reste une surcouche SSR/LR et ne s'applique pas aux autres raretés", () => {
  const { YokaiCard } = load("components/yokai-card.tsx");
  for (const rarity of ["C", "R", "SR"]) {
    const html = render(YokaiCard, { ...card, rarity, shiny: true });
    assert.doesNotMatch(html, /yk-shiny-frame/);
  }
  for (const rarity of ["SSR", "LR"]) {
    const html = render(YokaiCard, {
      ...card,
      rarity,
      shiny: true,
      animated: false
    });
    assert.match(html, new RegExp(`yk-rarity-${rarity}`));
    assert.match(html, /yk-shiny-frame/);
    assert.doesNotMatch(html, /yk-animated|yk-sparkle/);
    assert.match(html, /test-image\.png/);
  }
});

test("la carte affiche la franchise dans son cadre sans répéter la catégorie générique", () => {
  const { YokaiCard } = load("components/yokai-card.tsx");
  const withFranchise = render(YokaiCard, {
    ...card,
    anime: "Black Clover",
    animated: false
  });
  assert.match(withFranchise, /yk-card-anime[^>]*[^]*Black Clover/);
  const withoutFranchise = render(YokaiCard, {
    ...card,
    category: "Anime\/Manga",
    anime: undefined,
    animated: false
  });
  assert.doesNotMatch(withoutFranchise, /yk-card-anime/);
});

test("un solde absent reste inconnu, un solde connu utilise en-US", () => {
  const { Karas } = load("components/ui/index.tsx");
  assert.match(render(Karas, {}), /Karas balance unavailable/);
  assert.match(render(Karas, {}), /—/);
  assert.match(render(Karas, { amount: 1240 }), /1,240/);
});

test("les modales imbriquées libèrent le scroll et la confirmation remplace le détail", () => {
  const modal = readFileSync(
    path.join(root, "components/ui/index.tsx"),
    "utf8"
  );
  const collection = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/modalLockCount = Math\.max\(0, modalLockCount - 1\)/)
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(
      /if \(modalLockCount === 0\) document\.body\.style\.overflow = bodyOverflowBeforeModal/
    )
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(
      /onClose=\{\(\) => \{ if \(open && !ref\.current\?\.open\) onClose\(\); \}\}/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(modal),
    normalizeWhitespace(/onClose=\{\(\) => \{ if \(open\) onClose\(\); \}\}/)
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(
      /open=\{!!selected&&!discardConfirm&&!auctionOpen&&!evolveConfirm\}/
    )
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/open=\{auctionOpen&&!!selected\}/)
  );
});

test("la destruction multiple est active et transmet tous les exemplaires sélectionnés", () => {
  const collection = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  const controls = readFileSync(
    path.join(root, "components/ui/index.tsx"),
    "utf8"
  );
  const styles = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(
      /onDiscardMany\(selectedCards\.map\(card => card\.instanceId\)\)/
    )
  );
  assert.match(
    normalizeWhitespace(controls),
    normalizeWhitespace(/busy\?"Destruction…":"Détruire la sélection"/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(collection),
    normalizeWhitespace(/Destruction bientôt disponible/)
  );
  assert.ok(
    collection.indexOf("<SelectionBar") >
      collection.indexOf("className={`yk-card-grid yk-collection-grid")
  );
  assert.match(
    normalizeWhitespace(
      styles.match(/\.yk-selection-bar \{[^}]+\}/)?.[0] ?? ""
    ),
    normalizeWhitespace(/position:\s*sticky/)
  );
  assert.match(
    normalizeWhitespace(
      styles.match(/\.yk-selection-bar \{[^}]+\}/)?.[0] ?? ""
    ),
    normalizeWhitespace(/bottom:\s*var\(--layout-gutter-compact\)/)
  );
  assert.match(
    normalizeWhitespace(game),
    normalizeWhitespace(/onDiscardMany=\{discardCollectionCards\}/)
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(
      /presentation\[card\.instanceId\]\?\.destructionValue\?\?DESTRUCTION_KARAS\[card\.rarity\]/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(collection),
    normalizeWhitespace(/const valueKnown = selectedCards/)
  );
});

test("la collection d'un ami montre ses images personnalisées sans proposer d'édition", () => {
  const { CollectionView } = load("components/collection.tsx");
  const html = render(CollectionView, {
    cards: [
      {
        ...card,
        image: "https://i.imgur.com/private.png",
        catalogueImage: "/catalogue.png"
      }
    ],
    categories: ["Test"],
    readOnly: true
  });
  assert.match(html, /Carte de test/);
  assert.match(html, /private\.png/);
  assert.doesNotMatch(
    html,
    /Sélection multiple|Détruire la sélection|Modifier le profil/
  );
});

test("le compteur de cartes ouvre toute collection autorisée en lecture seule", () => {
  const profile = readFileSync(
    path.join(root, "components/profile.tsx"),
    "utf8"
  );
  const communityCss = readFileSync(
    path.join(root, "styles/community.css"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/!isMe&&profile\.canViewCollection\?\(?<button/)
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/if\(!profile\|\|!profile\.canViewCollection\)return/)
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(
      /profile\.canViewCollection\?profile\.cardCount:"Privée"/
    )
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(
      /profile\.canViewCollection\?profile\.distinctCardCount:"Privée"/
    )
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/getFriendCollection\(friendId\)/)
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(
      /<CollectionView cards=\{friendCards\} categories=\{categories\} loadPaniniAlbums=\{loadFriendPaniniAlbums\} loadPaniniAlbumCards=\{loadFriendPaniniAlbumCards\} readOnly\/>/
    )
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/Voir la collection/)
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/className="yk-friend-collection-modal"/)
  );
  assert.match(
    normalizeWhitespace(communityCss),
    normalizeWhitespace(
      /\.yk-modal\.yk-friend-collection-modal \{ width: min\(1400px,calc\(100% - 32px\)\); \}/
    )
  );
});

test("le compteur wishlist d'un ami ouvre toute sa wishlist et chaque carte reste cliquable", () => {
  const profile = readFileSync(
    path.join(root, "components/profile.tsx"),
    "utf8"
  );
  if (profile.includes("data-profile-wishlist")) {
    assert.match(
      normalizeWhitespace(profile),
      normalizeWhitespace(
        /<button[^>]+onClick=\{\(\)=>setWishlistOpen\(true\)\}[^>]+data-profile-wishlist/
      )
    );
    assert.match(
      normalizeWhitespace(profile),
      normalizeWhitespace(/disabled=\{!profile\.canViewCollection\}/)
    );
    assert.match(profile, /aria-haspopup="dialog"/);
  } else {
    assert.match(
      normalizeWhitespace(profile),
      normalizeWhitespace(
        /profile\.friendshipStatus==="accepted"\?\(?<button[^>]+onClick=\{\(\)=>setWishlistOpen\(true\)\}/
      )
    );
  }
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/\$\{profile\.pseudo\}’s wishlist/)
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(
      /shown\.map\(card=>\(?<Link href=\{`\/recherche\?carte=\$\{card\.id\}`\}/
    )
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/View wishlist/)
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/aria-label=\{`View \$\{card\.name\} in the catalog`\}/)
  );
});

test("l’aperçu wishlist du profil garde des cartes compactes", () => {
  const profile = readFileSync(
    path.join(root, "components/profile.tsx"),
    "utf8"
  );
  const community = readFileSync(
    path.join(root, "styles/community.css"),
    "utf8"
  );
  if (profile.includes("data-profile-wishlist")) {
    assert.doesNotMatch(profile, /tab !== "wishlist"/);
    assert.doesNotMatch(profile, /\["wishlist", "Wishlist"\]/);
    assert.match(profile, /className="yk-card-grid yk-wishlist-grid"/);
  } else {
    assert.match(
      normalizeWhitespace(profile),
      normalizeWhitespace(
        /className="yk-card-grid yk-profile-wishlist-preview mt-5"/
      )
    );
  }
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /\.yk-profile-wishlist-preview \{ --card-grid-columns-xl: 5; --card-grid-columns-lg: 4; --card-grid-columns-md: 3; --card-grid-columns-sm: 2; \}/
    )
  );
});

test("une carte d'ami ouvre une proposition d'échange présélectionnée et extensible", () => {
  const collection = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  const trades = readFileSync(path.join(root, "components/trades.tsx"), "utf8");
  const community = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/\/echanges\?ami=.*&carte=/)
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/Proposer un échange/)
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(/initialRequestedCardId=\{searchParams\.get\("carte"\)/)
  );
  assert.match(
    normalizeWhitespace(trades),
    normalizeWhitespace(/setRequested\(new Set\(\[initialRequestedCardId\]\)\)/)
  );
  assert.match(
    normalizeWhitespace(trades),
    normalizeWhitespace(
      /selectGroupQuantity\(selected,group\.cards,quantity[+-]1\)/
    )
  );
});

test("le catalogue reprend la sidebar sans notion de possession ni action de masse", () => {
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "styles/community.css"), "utf8");
  const catalogue = source.slice(
    source.indexOf("export function SearchView"),
    source.indexOf("export function TradesView")
  );
  const detail = source.slice(
    source.indexOf("function CatalogueCardModal"),
    source.indexOf("function CatalogueFilterIcon")
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/yk-collection-sidebar/)
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/CatalogueFilterSection title="Rareté"/)
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/CatalogueFilterSection title="Catégorie"/)
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/<CardShell><YokaiCard/)
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/CARD_PAGE_SIZES\.map/)
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(
      /loadPage\(\{query,category,rarity,page,pageSize\}\)[^]*?\[query,category,rarity,page,pageSize,loadPage\]/
    )
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/<CatalogueCardModal selected=\{selected\}/)
  );
  assert.match(
    normalizeWhitespace(detail),
    normalizeWhitespace(/Current owners/)
  );
  assert.match(
    normalizeWhitespace(detail),
    normalizeWhitespace(/CardOwnerList title="Friends" owners=\{friendOwners\}/)
  );
  assert.match(
    normalizeWhitespace(detail),
    normalizeWhitespace(
      /CardOwnerList title="Other players" owners=\{otherOwners\}/
    )
  );
  assert.match(
    normalizeWhitespace(detail),
    normalizeWhitespace(/className="yk-catalogue-owner-columns"/)
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(
      /\.yk-catalogue-owner-columns \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/
    )
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(
      /\.yk-modal\.yk-catalogue-detail-modal \{[^}]*width: min\(72rem,calc\(100% - 48px\)\);[^}]*min-height: min\(46rem,calc\(100dvh - 48px\)\);[^}]*--collection-detail-art-width: 20rem;/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/title=\{owner\.pseudo\}/)
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(
      /\.yk-catalogue-owner-name \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/
    )
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(
      /\.yk-catalogue-owners ul \{[^}]*max-height: 220px;[^}]*overflow-y: auto;/
    )
  );
  assert.match(
    normalizeWhitespace(detail),
    normalizeWhitespace(/Add to my wishlist/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/Dossier|Sélection multiple|Obtenue le|possédée/)
  );
  assert.match(
    normalizeWhitespace(layout),
    normalizeWhitespace(/styles\/community\.css/)
  );
  assert.match(
    normalizeWhitespace(layout),
    normalizeWhitespace(/styles\/collection\.css/)
  );
  assert.match(
    normalizeWhitespace(catalogue),
    normalizeWhitespace(/className="yk-card-grid yk-catalogue-grid"/)
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(/\.yk-catalogue-card \{[^}]*width: 100%/)
  );
});

test("une carte de la wishlist ouvre le détail partagé du catalogue et ses possesseurs", () => {
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  const wishlist = source.slice(
    source.indexOf("export function WishlistView"),
    source.indexOf("const remaining")
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/function CatalogueCardModal/)
  );
  assert.match(
    normalizeWhitespace(wishlist),
    normalizeWhitespace(
      /aria-label=\{`View \$\{card\.name\}, \$\{card\.rarity\}`\}/
    )
  );
  assert.match(
    normalizeWhitespace(wishlist),
    normalizeWhitespace(/aria-haspopup="dialog"/)
  );
  assert.match(
    normalizeWhitespace(wishlist),
    normalizeWhitespace(/<CatalogueCardModal selected=\{selected\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Current owners/)
  );
});

test("la wishlist reprend le tri et les effets statiques du catalogue", () => {
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  const wishlist = source.slice(
    source.indexOf("export function WishlistView"),
    source.indexOf("const remaining")
  );
  assert.match(wishlist, /id="wishlist-filters"/);
  assert.match(wishlist, /CatalogueFilterSection title="Sort"/);
  assert.match(wishlist, /CatalogueFilterSection title="Rarity"/);
  assert.match(wishlist, /CatalogueFilterSection title="Category"/);
  assert.match(
    normalizeWhitespace(wishlist),
    normalizeWhitespace(/<YokaiCard \{\.\.\.card\} animated=\{false\}/)
  );
});

test("le bouton de retrait de la wishlist utilise le style danger rouge", () => {
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  const wishlist = source.slice(
    source.indexOf("export function WishlistView"),
    source.indexOf("const remaining")
  );
  assert.match(
    normalizeWhitespace(wishlist),
    normalizeWhitespace(/<Button variant="danger"/)
  );
  assert.match(
    normalizeWhitespace(wishlist),
    normalizeWhitespace(/>♡ Remove<\/Button>/)
  );
});

test("le chat d’enchère est visible mais réservé au vendeur et aux utilisateurs ayant misé", () => {
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  const market = readFileSync(path.join(root, "lib/data/market.ts"), "utf8");
  const css = readFileSync(path.join(root, "styles/market.css"), "utf8");
  const gifPicker = readFileSync(
    path.join(root, "components/gif-picker.tsx"),
    "utf8"
  );
  const tokens = readFileSync(path.join(root, "tailwind.config.ts"), "utf8");
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/function AuctionChatPanel/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/The seller and bidders can post/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/chat\?\.canPost&&!finished/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/adapter\.get\(auctionId\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/adapter\.send\(auctionId,message,gif\?\.url\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/maxLength=\{500\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/event\.key==="Enter"&&!event\.shiftKey/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/event\.preventDefault\(\);void send\(\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/chat\?\.participants\.filter/)
  );
  assert.match(
    normalizeWhitespace(market),
    normalizeWhitespace(
      /CHAT_PARTICIPANTS_ONLY:"Only the seller and bidders can join the chat\."/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/auction-mention-options/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/@ to mention/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /<GifPicker disabled=\{busy\|\|retrySeconds>0\} onSelect=\{gif=>void send\(gif\)\}/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/item\.gifUrl\?\(?<img className="yk-auction-chat-gif"/)
  );
  assert.match(
    normalizeWhitespace(gifPicker),
    normalizeWhitespace(/api\.giphy\.com\/v1\/gifs/)
  );
  assert.match(
    normalizeWhitespace(gifPicker),
    normalizeWhitespace(/Powered by GIPHY/)
  );
  assert.match(
    normalizeWhitespace(gifPicker),
    normalizeWhitespace(/PAGE_SIZE=18/)
  );
  assert.match(
    normalizeWhitespace(gifPicker),
    normalizeWhitespace(/Load more/)
  );
  assert.match(
    normalizeWhitespace(gifPicker),
    normalizeWhitespace(/Send this GIF/)
  );
  assert.match(
    normalizeWhitespace(gifPicker),
    normalizeWhitespace(/GIF_CATEGORIES/)
  );
  assert.match(normalizeWhitespace(gifPicker), normalizeWhitespace(/Trending/));
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/event\.key==="ArrowDown"\|\|event\.key==="ArrowUp"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/event\.key==="Enter"\|\|event\.key==="Tab"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /selectMention\(mentionOptions\[mentionIndexRef\.current\]\.pseudo\)/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/button\[aria-selected="true"\]/)
  );
  assert.match(
    normalizeWhitespace(market),
    normalizeWhitespace(/get_auction_chat/)
  );
  assert.match(
    normalizeWhitespace(market),
    normalizeWhitespace(/send_auction_chat_message/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/grid-template-areas: "art main" "history main"/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-auction-page \{[^}]*left: -8rem/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /#main-content:has\(\.yk-auction-page\) \{[^}]*max-width: 72rem/
    )
  );
  assert.match(
    normalizeWhitespace(tokens),
    normalizeWhitespace(/\[["']--market-art-width["'], ["']19rem["']\]/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-auction-main \{[^}]*grid-template-columns: minmax\(0,1fr\) 24rem/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-auction-main \{[^}]*grid-template-areas: "header \." "panel chat"/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-auction-header \{ grid-area: header/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-auction-panel \{ grid-area: panel/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-auction-chat \{ grid-area: chat/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-auction-chat-form textarea \{[^}]*resize: none/)
  );
});

test("le panneau d’enchère ne grandit pas avec la hauteur du chat", () => {
  const market = readFileSync(path.join(root, "styles/market.css"), "utf8");
  assert.match(market, /\.yk-auction-panel \{[^}]*align-self: start;/);
});

test("mobile : vitrine du profil en carrousel tactile et page Amis sans débordement", () => {
  const profile = readFileSync(
    path.join(root, "components/profile.tsx"),
    "utf8"
  );
  const community = readFileSync(
    path.join(root, "styles/community.css"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/className="yk-card-grid yk-featured-stage"/)
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(/\.yk-profile-columns > section \{ min-width: 0; \}/)
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /\.yk-featured-stage \{ --card-grid-columns-xl: 5; --card-grid-columns-lg: 5; --card-grid-columns-md: 5;/
    )
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /@media \(max-width: 700px\) \{[^]*?\.yk-featured-stage \{[^}]*display: flex;[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/
    )
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /@media \(max-width: 700px\) \{[^]*?\.yk-featured-stage > div \{[^}]*flex: 0 0 min\(72vw,13rem\);[^}]*scroll-snap-align: center;/
    )
  );
  // Grid children must be allowed to shrink, otherwise the non-wrapping tabs widen the page.
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(/\.yk-social-stack > \* \{ min-width: 0; \}/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /\.yk-social-person \.yk-friend-action,[^{]*\{ width: 100%; margin-left/
    )
  );
  const friends = readFileSync(
    path.join(root, "components/friends.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(friends),
    normalizeWhitespace(
      /const liveFriendsPanel: FriendsPanelAdapter = \{ friendships: getFriendships, search: searchUsers, respond: respondFriendRequest, remove: removeFriend \}/
    )
  );
  assert.match(
    normalizeWhitespace(friends),
    normalizeWhitespace(
      /tab === "friends" \?\(? <Button variant="danger" onClick=\{\(\) => setRemoval\(person\)\}>Remove<\/Button>/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(friends),
    normalizeWhitespace(/<StatusPill tone="success">Friend<\/StatusPill>/)
  );
  assert.match(
    normalizeWhitespace(friends),
    normalizeWhitespace(/title="Remove this friend\?"/)
  );
});

test("la liste d’amis affiche la présence et actualise la dernière activité", () => {
  const friends = readFileSync(
    path.join(root, "components/friends.tsx"),
    "utf8"
  );
  const heartbeat = readFileSync(
    path.join(root, "components/presence-heartbeat.tsx"),
    "utf8"
  );
  const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(
    normalizeWhitespace(layout),
    normalizeWhitespace(/<PresenceHeartbeat\/>/)
  );
  assert.match(
    normalizeWhitespace(heartbeat),
    normalizeWhitespace(/touchPresence\(\)/)
  );
  assert.match(
    normalizeWhitespace(heartbeat),
    normalizeWhitespace(/PRESENCE_THROTTLE_MS = 30_000/)
  );
  for (const event of [
    "pointerdown",
    "pointermove",
    "keydown",
    "scroll",
    "touchstart"
  ])
    assert.match(heartbeat, new RegExp(event));
  assert.doesNotMatch(
    normalizeWhitespace(heartbeat),
    normalizeWhitespace(/setInterval/)
  );
  assert.match(
    normalizeWhitespace(friends),
    normalizeWhitespace(/showPresence=\{tab==="friends"\}/)
  );
  assert.match(
    normalizeWhitespace(friends),
    normalizeWhitespace(/window\.setInterval\(\(\)=>void refresh\(\),30_000\)/)
  );
  const { friendPresenceLabel } = load("components/friends.tsx");
  const now = Date.parse("2026-10-08T12:00:00Z");
  assert.equal(
    friendPresenceLabel(
      { isOnline: true, lastSeenAt: "2026-10-08T10:00:00Z" },
      now
    ),
    "Online"
  );
  assert.equal(
    friendPresenceLabel(
      { isOnline: false, lastSeenAt: "2026-10-08T11:55:00Z" },
      now
    ),
    "Last seen 5 minutes ago"
  );
  assert.equal(
    friendPresenceLabel(
      { isOnline: false, lastSeenAt: "2026-10-08T09:00:00Z" },
      now
    ),
    "Last seen 3 hours ago"
  );
  assert.equal(
    friendPresenceLabel({ isOnline: false, lastSeenAt: null }, now),
    "Not seen online yet"
  );
});

test("le sélecteur de cartes mises en avant recherche et remonte la sélection", () => {
  const source = readFileSync(
    path.join(root, "components/profile.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/const FEATURED_CARD_LIMIT=5/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/next\.size<FEATURED_CARD_LIMIT/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/id="featured-query"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/matchesCardSearch\(featuredQuery/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /Number\(selected\.has\(b\.instanceId\)\)-Number\(selected\.has\(a\.instanceId\)\)/
    )
  );
});

test("le profil invalide l’avatar partagé et la Topbar le recharge", () => {
  const profile = readFileSync(path.join(root, "lib/data/profile.ts"), "utf8");
  const topbar = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  assert.match(
    normalizeWhitespace(profile),
    normalizeWhitespace(/publishPlayerSnapshotInvalidation\(\["profile"\]\)/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/refreshProfile\(\);const unsubscribe/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/scopes\.includes\("profile"\)/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/image=\{avatarUrl\}/)
  );
});

test("l’avatar ouvre un menu profil compact avec résumé et actions", () => {
  const topbar = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  const account = readFileSync(
    path.join(root, "components/account-menu.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(root, "styles/topbar.css"), "utf8");
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/header-logo-gold\.png/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-brand \{ display: flex; width: 104px;/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/aria-label="Open my account"/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/panel==="account"/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/className="yk-account-panel"/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/>View my profile<\/Link>/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/>Settings<\/Link>/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/>My achievements<\/Link>/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/aria-current=\{view === "achievements"/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/toLocaleString\("en-US"\).*Karas/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/className="yk-account-karas"/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/yk-mobile-account/)
  );
  assert.ok(
    normalizeWhitespace(topbar).indexOf(
      normalizeWhitespace('href="/wishlist"')
    ) <
      normalizeWhitespace(topbar).indexOf(
        normalizeWhitespace('href="/recherche" aria-current')
      )
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(
      /document\.addEventListener\("pointerdown",closeOnOutsidePointer\)/
    )
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/closest\(`#\$\{panelId\},\[aria-controls=/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/Gère ton profil et ta session/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/>Close<\/button>/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(topbar),
    normalizeWhitespace(/<Modal open=\{panel === "account"\}/)
  );
  assert.match(
    normalizeWhitespace(account),
    normalizeWhitespace(/<SignOutButton \/>/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/width: min\(280px/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/background: #0f0c1d/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/box-shadow: 0 12px 32px -4px rgba\(4,0,11,0?\.95\)/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-account-karas \{ display: none; \}/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /max-width: 620px[^]*\.yk-account-karas \{ display: block; \}/
    )
  );
});

test("la destruction groupée demande une confirmation chiffrée", () => {
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/setBulkDiscardConfirm\(true\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Action irréversible\./)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/selectedCards\.length/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/selectedValue\?\?"…"/)
  );
});

test("barre d'outils Collection compacte sur mobile et tiroir fermé même en mouvement réduit", () => {
  const collection = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  const ui = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  // The filter trigger lives inside the toolbar so both collapse into two compact rows.
  assert.ok(
    collection.indexOf('className="yk-mobile-filter-trigger"') >
      collection.indexOf('<div className="yk-collection-toolbar">')
  );
  // Mobile: "Sélection multiple" becomes an icon; the label stays available to screen readers.
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-collection-toolbar \.yk-selection-mode-label \{ position: absolute;/
    )
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/<SelectionModeButton active=\{selecting\}/)
  );
  // The global reduced-motion reset drops transforms: the closed drawer and the Karas gem must keep theirs.
  assert.match(
    normalizeWhitespace(ui),
    normalizeWhitespace(/transform: none !important/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /@media \(prefers-reduced-motion: reduce\) and \(max-width: 760px\) \{ \.yk-collection-sidebar:not\(\.yk-sidebar-open\) \{ transform: translateX\(-100%\) !important; \} \}/
    )
  );
  assert.match(
    normalizeWhitespace(ui),
    normalizeWhitespace(
      /\.yk-karas-gem \{ transform: rotate\(45deg\) !important; \}/
    )
  );
});

test("Collection, Catalogue et Marché partagent une seule échelle de colonnes", () => {
  const ui = readFileSync(path.join(root, "styles/ui.css"), "utf8");
  assert.match(
    normalizeWhitespace(ui),
    normalizeWhitespace(
      /\.yk-card-grid \{ display: grid; grid-template-columns: repeat\(var\(--card-grid-columns,var\(--card-grid-columns-xl\)\)/
    )
  );
  assert.match(
    normalizeWhitespace(ui),
    normalizeWhitespace(
      /max-width: 760px\) \{ \.yk-card-grid \{ --card-grid-columns: var\(--card-grid-columns-sm\)/
    )
  );
  assert.match(
    normalizeWhitespace(
      readFileSync(path.join(root, "components/collection.tsx"), "utf8")
    ),
    normalizeWhitespace(/className=\{`yk-card-grid yk-collection-grid /)
  );
  assert.match(
    normalizeWhitespace(
      readFileSync(path.join(root, "components/community-views.tsx"), "utf8")
    ),
    normalizeWhitespace(/className="yk-card-grid yk-market-list"/)
  );
  assert.match(
    normalizeWhitespace(
      readFileSync(path.join(root, "components/community-views.tsx"), "utf8")
    ),
    normalizeWhitespace(/className="yk-card-grid yk-wishlist-grid"/)
  );
  // No page may redefine its own column count for these grids (the 1280px :not() override broke mobile).
  for (const file of ["collection", "community", "market"]) {
    const css = readFileSync(path.join(root, `styles/${file}.css`), "utf8");
    assert.doesNotMatch(
      normalizeWhitespace(css),
      normalizeWhitespace(
        /\.yk-(?:collection-grid|catalogue-grid|market-list|wishlist-grid)(?::not\([^)]*\))? \{[^}]*grid-template-columns: repeat/
      )
    );
  }
});

test("la collection annonce la récompense de fusion correspondant à la migration installée", () => {
  // Product change approved separately: keep the legacy contract until the UR
  // migration exists, then require the new contract (never accept either at will).
  const urEvolution = existsSync(
    path.join(root, "supabase/migrations/20261015000008_ssr_evolution_ur.sql")
  );
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      urEvolution ? /Confirm UR evolution/ : /évolution Shiny/i
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(urEvolution ? /UR progress/ : /Progression Shiny/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      urEvolution
        ? /\{evolvableCopies\}\/5 copies/
        : /\{evolvableCopies\}\/5 exemplaires/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(source),
    normalizeWhitespace(/Évolution LR|Évoluer en LR/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      urEvolution ? /Confirm UR evolution/ : /Confirmer l’évolution Shiny/
    )
  );
  if (urEvolution) {
    assert.match(
      normalizeWhitespace(source),
      normalizeWhitespace(/Evolve to UR/)
    );
    assert.match(
      normalizeWhitespace(source),
      normalizeWhitespace(/new non-shiny UR/)
    );
    assert.doesNotMatch(
      source,
      /Progression Shiny|Évoluer en Shiny|Confirmer l’évolution Shiny/
    );
  }
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /Image : \{card\.customImageUrl\?"personnalisée \(sera perdue\)":"d’origine"\}/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /onEvolve\(evolutionCards\.map\(card=>card\.instanceId\)\)/
    )
  );
});

test("le Decision Pack confirmé affiche une carte gardée et quatre perdues", () => {
  const { BoosterReveal } = load("components/boosters.tsx");
  const cards = Array.from({ length: 5 }, (_, i) => ({
    ...card,
    instanceId: `copy-${i}`
  }));
  const html = render(BoosterReveal, {
    cards,
    revealed: 5,
    onReveal() {},
    onRevealAll() {},
    onReturn() {},
    decision: {
      keptId: "copy-3",
      async onKeep() {
        assert.fail("Rendering must not confirm a choice");
      }
    }
  });
  assert.equal((html.match(/yk-lost-stamp/g) || []).length, 4);
  assert.equal((html.match(/GARDÉE/g) || []).length, 1);
  assert.doesNotMatch(html, />Détruire</);
  assert.match(
    html,
    /Carte ajoutée à ta collection · \+0 Karas depuis les cartes non conservées/
  );
  assert.match(html, />SSR ×(?:<!-- -->)?1</);
  assert.doesNotMatch(html, />SSR ×(?:<!-- -->)?5</);
});

test("la collection pagine par multiples de 6 pour remplir la grille", () => {
  const { CollectionView } = load("components/collection.tsx");
  const cards = Array.from({ length: 30 }, (_, i) => ({
    ...card,
    id: `card-${i}`,
    instanceId: `copy-${i}`,
    folderId: null
  }));
  const html = render(CollectionView, {
    cards,
    categories: [],
    folders: [],
    async onMoveCard() {},
    async onCreateAuction() {},
    async onEvolve() {},
    async onSetCustomImage() {},
    async onDiscard() {},
    async onDiscardMany() {}
  });
  assert.equal((html.match(/class="yk-collection-card[ "]/g) || []).length, 24);
  assert.match(
    html,
    /<option value="24"[^>]*>24<\/option><option value="36"[^>]*>36<\/option><option value="48"[^>]*>48<\/option>/
  );
  assert.doesNotMatch(html, /Cartes par page \(non disponible/);
});

test("le Classeur affiche 28 cartes par page par défaut", () => {
  const source = readFileSync("components/collection.tsx", "utf8");
  const pagination = readFileSync("lib/ui/pagination.ts", "utf8");

  assert.match(source, /BINDER_CARD_PAGE_SIZES\[0\]/);
  assert.match(source, /BINDER_CARD_PAGE_SIZES\.map/);
  assert.match(pagination, /BINDER_CARD_PAGE_SIZES = \[28, 42, 56\]/);
});

test("les copies normales et Shiny forment des tuiles distinctes avec badge de quantité", () => {
  const { CollectionView } = load("components/collection.tsx");
  const copies = [
    { ...card, instanceId: "normal-1", folderId: null, shiny: false },
    {
      ...card,
      instanceId: "normal-2",
      folderId: "favorites",
      shiny: false,
      customImageUrl: "https://i.imgur.com/custom.png",
      image: "/custom.png"
    },
    { ...card, instanceId: "shiny-1", folderId: null, shiny: true }
  ];
  const html = render(CollectionView, {
    cards: copies,
    categories: [],
    folders: [{ id: "favorites", name: "Favoris" }],
    async onDiscardMany() {},
    async onEvolve() {}
  });
  assert.equal((html.match(/class="yk-collection-card[ "]/g) || []).length, 2);
  assert.match(html, /×(?:<!-- -->)?2/);
  assert.doesNotMatch(html, /×(?:<!-- -->)?1/);
  assert.match(html, /custom\.png/);
});

test("la collection signale et catégorise les cartes en enchères", () => {
  const { CollectionView } = load("components/collection.tsx");
  const auctionCard = { ...card, instanceId: "auction-copy", folderId: null };
  const html = render(CollectionView, {
    cards: [auctionCard],
    categories: [],
    presentation: {
      "auction-copy": {
        frozen: { remaining: "2026-10-07T12:00:00Z" },
        auctionId: "auction-1"
      }
    },
    async onCreateAuction() {}
  });
  assert.match(html, /Statut/);
  assert.match(html, /En enchères/);
  assert.match(html, /yk-group-frozen/);
  assert.match(html, /1 en enchère/);
});

test("Phase 5 : habillage des boosters sans toucher au reveal", () => {
  const { BoosterReveal, Boosters } = load("components/boosters.tsx");
  const cards = Array.from({ length: 5 }, (_, i) => ({
    ...card,
    instanceId: `copy-${i}`,
    anime: "Spirit Realm"
  }));
  const regular = render(BoosterReveal, {
    cards,
    revealed: 2,
    onReveal() {},
    onReturn() {},
    async onDiscard() {}
  });
  assert.equal((regular.match(/>Défausser</g) || []).length, 2);
  assert.doesNotMatch(
    normalizeWhitespace(regular),
    normalizeWhitespace(/>Sélectionner</)
  );
  assert.doesNotMatch(
    normalizeWhitespace(regular),
    normalizeWhitespace(/Voir ma collection|yk-reveal-summary/)
  );
  const regularDone = render(BoosterReveal, {
    cards,
    revealed: 5,
    onReveal() {},
    onReturn() {},
    async onDiscard() {}
  });
  assert.match(
    normalizeWhitespace(regularDone),
    normalizeWhitespace(/href="\/collection"[^>]*>Voir ma collection</)
  );
  assert.match(
    normalizeWhitespace(regularDone),
    normalizeWhitespace(/>Sélectionner</)
  );
  assert.equal((regularDone.match(/>Défausser</g) || []).length, 5);
  const choosing = render(BoosterReveal, {
    cards,
    revealed: 5,
    onReveal() {},
    onReturn() {},
    decision: {
      async onKeep() {
        return 0;
      }
    }
  });
  assert.equal((choosing.match(/>Garder celle-ci</g) || []).length, 5);
  assert.doesNotMatch(
    normalizeWhitespace(choosing),
    normalizeWhitespace(/yk-slot-button">Défausser/)
  );
  const selection = render(Boosters, {
    status: { available: 0, maximum: 5, nextPackAt: Date.now() + 60_000 },
    countdown: "01:00",
    decisionStatus: {
      available: false,
      pending: [],
      nextPackAt: new Date().setHours(24, 30, 0, 0)
    },
    decisionCountdown: "10:00:00",
    busy: false,
    draw: [],
    drawKind: "regular",
    collection: [],
    revealed: 0,
    async onOpen() {},
    async onKeepDecision() {
      return 0;
    },
    async onDiscard() {},
    onReveal() {}
  });
  assert.match(
    normalizeWhitespace(selection),
    normalizeWhitespace(/0\/5 en réserve/)
  );
  assert.match(
    normalizeWhitespace(selection),
    normalizeWhitespace(/Prochain dans 01:00/)
  );
  assert.match(
    normalizeWhitespace(selection),
    normalizeWhitespace(/1 carte à garder parmi 5/)
  );
  assert.match(
    normalizeWhitespace(selection),
    normalizeWhitespace(/Revient demain à 00:30/)
  );
  assert.equal(
    (selection.match(/aria-label="Voir les taux du Booster/g) || []).length,
    2
  );
  assert.match(
    normalizeWhitespace(
      readFileSync(path.join(root, "components/boosters.tsx"), "utf8")
    ),
    normalizeWhitespace(/Taux de drop du Booster/)
  );
  const source = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  assert.match(
    source,
    /DECISION_DROP_RATES[^\n]*SR", percent: 96\.5[^\n]*SSR", percent: 3[^\n]*LR", percent: 0\.5/
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/decisionDropRates = DECISION_DROP_RATES/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /ratesKind === "decision" \? decisionDropRates : dropRates/
    )
  );
  assert.match(
    normalizeWhitespace(
      readFileSync(path.join(root, "components/game.tsx"), "utf8")
    ),
    normalizeWhitespace(/decisionDropRates=\{info\?\.decisionDropRates\}/)
  );
  const boosterStyles = readFileSync(
    path.join(root, "styles/boosters.css"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /Garder cette carte et perdre les \{cards\.length - 1\} autres \?/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-reveal-selection-mode \{[^}]*width: auto;[^}]*min-height: 32px;/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /@media \(max-width: 40rem\) \{[\s\S]*\.yk-reveal-progress \{ grid-column: 1; grid-row: 2; justify-self: start; \}[\s\S]*\.yk-reveal-selection-mode \{ grid-column: 2; grid-row: 2; \}/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-invocation\[open\] \{ display: grid; place-items: center; overflow: hidden; \}/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-invocation > div:first-child \{ position: absolute;/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-invocation > div:last-child \{ grid-area: 1 \/ 1;/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-reveal-ssr \{ position: fixed; inset: 0; z-index: 40;[^}]*justify-content: center;/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-reveal-lr \{ position: fixed; inset: 0; z-index: 40;[^}]*justify-content: center;/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-reveal-ssr \.yk-face-up \{ transform: scale\(1\.14\); \}/
    )
  );
  assert.match(
    normalizeWhitespace(boosterStyles),
    normalizeWhitespace(
      /\.yk-reveal-lr \.yk-face-up \{ transform: scale\(1\.18\); \}/
    )
  );
});

test("les boosters annoncent les gains autoritaires avant confirmation", () => {
  const { BoosterReveal } = load("components/boosters.tsx");
  const values = [1, 2, 3, 4, 5];
  const cards = values.map((destructionValue, i) => ({
    ...card,
    instanceId: `copy-${i}`,
    destructionValue
  }));
  const regular = render(BoosterReveal, {
    cards,
    revealed: 5,
    onReveal() {},
    onReturn() {},
    async onDiscard() {}
  });
  assert.match(
    normalizeWhitespace(regular),
    normalizeWhitespace(/>Sélectionner</)
  );
  assert.doesNotMatch(
    normalizeWhitespace(regular),
    normalizeWhitespace(/Défausser \(\+/)
  );
  const decision = render(BoosterReveal, {
    cards,
    revealed: 5,
    onReveal() {},
    onReturn() {},
    decision: {
      async onKeep() {
        return 14;
      }
    }
  });
  assert.equal((decision.match(/>Garder celle-ci</g) || []).length, 5);
  assert.doesNotMatch(
    normalizeWhitespace(decision),
    normalizeWhitespace(/Garder celle-ci \(\+/)
  );
  const source = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /selectedCards\.reduce\(\(sum,card\)=>sum\+card\.destructionValue!/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /Tu recevras <strong className="text-karas">\{selectedValue\}/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/if\(destroyingAll\)onReturn\(\)/)
  );
  const migration = readFileSync(
    path.join(
      root,
      "supabase/migrations/20261001000002_booster_destruction_estimates.sql"
    ),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(migration),
    normalizeWhitespace(/public\.card_destruction_value\(owned\.rarity\)/)
  );
  assert.match(
    normalizeWhitespace(migration),
    normalizeWhitespace(
      /sum\(public\.card_destruction_value\(other_choices\.rarity\)\)/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(migration),
    normalizeWhitespace(/reward\s*:=\s*case/)
  );
  assert.ok(
    existsSync(
      path.join(root, "app/design-system/booster-karas-preview/page.tsx")
    )
  );
});

test("une carte révélée ouvre le détail de collection avant sa mise en vente", () => {
  const boosters = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /<CollectionView[^]*detailOnly[^]*initialSelectedId=\{detailCard\.instanceId\}/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(boosters),
    normalizeWhitespace(/className="yk-slot-button">Mettre en vente<\/Button>/)
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /auctioned\.has\(card\.instanceId\)\?\(?<StatusPill tone="info">EN VENTE/
    )
  );
  assert.match(
    normalizeWhitespace(boosters),
    normalizeWhitespace(
      /visibleCards\.filter\(card=>!auctioned\.has\(card\.instanceId\)&&!locked\.has\(card\.instanceId\)\)/
    )
  );
  assert.match(
    normalizeWhitespace(game),
    normalizeWhitespace(/onAuction=\{auctionCard\}/)
  );
});

test("le détail d'une carte révélée propose verrouillage puis enchère", () => {
  const boosters = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  assert.match(boosters, /onMoveCard=\{onMoveCard\}/);
  assert.match(boosters, /onCreateAuction=\{auction\}/);
  assert.match(boosters, /onSetLocked=\{lock\}/);
  assert.match(boosters, /onSetCustomImage=\{onSetCustomImage\}/);
  assert.match(boosters, /onDiscard=\{onDiscard\}/);
  assert.match(game, /onSetLocked=\{lockCard\}/);
});

test("la modale de détail hiérarchise verrouillage, progression et actions avancées", () => {
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  const modal = source.slice(
    source.indexOf('title="Détail de la carte"'),
    source.indexOf('title="Détruire des exemplaires ?"')
  );
  assert.ok(modal.indexOf("yk-detail-art") < modal.indexOf("yk-detail-folder"));
  assert.ok(
    modal.indexOf("yk-detail-folder") < modal.indexOf("yk-detail-info")
  );
  assert.ok(
    modal.indexOf("yk-detail-actions") < modal.indexOf("yk-detail-image")
  );
  assert.ok(
    modal.indexOf("yk-detail-image") < modal.indexOf("yk-detail-danger")
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(
      /className="yk-detail-title-row"><h3[^>]*>\{selected\.name\}<\/h3>[^]*className="yk-detail-lock-toggle"/
    )
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/aria-pressed=\{!!selected\.locked\}/)
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/role="progressbar"/)
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/aria-valuenow=\{Math\.min\(evolvableCopies,5\)\}/)
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(
      /<details className="yk-detail-image"><summary>Personnaliser l'image/
    )
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/Détruire des exemplaires/)
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/Revenir à l’image d’origine/)
  );
  assert.match(
    normalizeWhitespace(modal),
    normalizeWhitespace(/selectedMeta\?\.marketValue!=null&&/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(modal),
    normalizeWhitespace(/Une carte verrouillée ne peut pas être vendue/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(modal),
    normalizeWhitespace(/aria-label=\{`Détruire \$\{selected\.name\}`\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/setDiscardConfirm\(true\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/setDiscardQuantity\(destructibleCards\.length\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/\{discardValue\} Kara/)
  );
});

test("les cartes verrouillees sont exclues des actions sensibles", () => {
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /filter\(card=>!card\.locked&&!presentation\[card\.instanceId\]\?\.frozen\)/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /filter\(c=>!c\.locked&&!presentation\[c\.instanceId\]\?\.frozen\)/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Verrouiller la carte/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Déverrouiller la carte/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/selected\.locked\?"Carte verrouillée"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Cartes verrouillées/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/folder === LOCKED_FOLDER \? !!c\.locked/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/folder!==LOCKED_FOLDER/)
  );
});

test("la Collection groupe les tuiles et sélectionne tous les exemplaires disponibles", () => {
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/const groups = groupCollection\(filtered\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/visibleGroups\.map\(group=>/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /group\.cards\.length>1&&\(?<span[^>]*>×\{group\.cards\.length\}/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/toggleGroup\(group\.cards\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/count=\{selectedCards\.length\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/frozenCount>0/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(source),
    normalizeWhitespace(/Dernier exemplaire obtenu le/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      />Obtenu le <time dateTime=\{historyGroup\.firstObtainedAt\}>\{formatDate\(historyGroup\.firstObtainedAt\)\}<\/time>/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /Premier propriétaire, obtenu le \{formatDate\(historyGroup\.firstObtainedAt\)\}/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/yk-copy-picker/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/itemLabel="exemplaire"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/toggleEvolutionCard/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Choisis précisément cinq exemplaires/)
  );
});

test("la sélection multiple peut être rangée dans un dossier", () => {
  const collection = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  const game = readFileSync(path.join(root, "components/game.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(
      /onMoveCards\?: \(instanceIds: string\[\], folderId: string \| null\)/
    )
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/selectedCards\.map\(card => card\.instanceId\)/)
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/>Choisir un dossier…<\/option>/)
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/bulkFolderBusy\?"Rangement…":"Ranger"/)
  );
  assert.match(
    normalizeWhitespace(game),
    normalizeWhitespace(/onMoveCards=\{moveCards\}/)
  );
  assert.match(
    normalizeWhitespace(styles),
    normalizeWhitespace(/\.yk-selection-folder \{/)
  );
});

test("la mise en vente suggère la valeur de marché sans remplacer le prix par défaut", () => {
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/loadCardDiscovery = getCardDiscovery/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/await loadCardDiscovery\(selected\.id\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/setAuctionPrice\("10"\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/value!=null&&Number\.isFinite\(value\)&&value>0/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Suggestion : <Karas amount=\{auctionSuggestion\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /onClick=\{\(\)=>setAuctionPrice\(String\(auctionSuggestion\)\)\}>Utiliser cette valeur/
    )
  );
  const proof = readFileSync(
    path.join(root, "components/auction-suggestion-proof.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(proof),
    normalizeWhitespace(/marketValue: disabled \? null : 240/)
  );
  const preview = readFileSync(
    path.join(root, "app/design-system/auction-suggestion-preview/page.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(preview),
    normalizeWhitespace(/\(await searchParams\)\.disabled === "1"/)
  );
});

test("Phase 6 : liste du marché, suivi et Mes enchères", () => {
  const { MarketView } = load("components/community-views.tsx");
  const auction = (id, extra = {}) => ({
    id,
    card: { ...card, id: `card-${id}` },
    amount: 120,
    remaining: "00:12:00",
    remainingSeconds: 720,
    seller: "Kitsune",
    sellerAvatarUrl: "https://cdn.example/kitsune.png",
    bids: 3,
    ...extra
  });
  const lists = {
    active: [
      auction("a", { wishlist: true }),
      auction("b", { remainingSeconds: 120, remaining: "00:02:00" })
    ],
    mine: [],
    won: [],
    sold: []
  };
  for (const [count, label] of [
    [0, "0 cards up for auction"],
    [1, "1 card up for auction"],
    [2, "2 cards up for auction"]
  ]) {
    const pluralHtml = render(MarketView, {
      lists: { ...lists, active: lists.active.slice(0, count) }
    });
    assert.ok(pluralHtml.includes(label), label);
  }
  const html = render(MarketView, {
    lists,
    activeSales: "0",
    async onToggleWatch() {}
  });
  assert.equal((html.match(/class="yk-market-tile"/g) || []).length, 2);
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(
      /aria-pressed="true"[^>]*aria-label="Unwatch auction"[^>]*>.*?<span class="yk-watch-label">Watching<\/span>/
    )
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(/https:\/\/cdn\.example\/kitsune\.png/)
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(
      /aria-pressed="false"[^>]*aria-label="Watch auction"[^>]*>.*?<span class="yk-watch-label">Watch<\/span>/
    )
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(/yk-market-timer yk-urgency-critical/)
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(
      /<aside id="market-filters" class="yk-collection-sidebar /
    )
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(/id="market-query" type="search"/)
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(
      /aria-pressed="true"><span class="yk-filter-check"><\/span><span>Ending soon<\/span>/
    )
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(
      /<span>Price: low to high<\/span>.*<span>Price: high to low<\/span>/
    )
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(/aria-controls="market-filters"/)
  );
  const search = render(MarketView, {
    pageHeading: React.createElement(
      "div",
      null,
      React.createElement("h1", null, "Market")
    ),
    lists: {
      ...lists,
      active: [
        auction("l", {
          card: {
            ...card,
            id: "l",
            name: "Luffy",
            anime: "One Piece",
            category: "Manga"
          }
        }),
        auction("z", {
          card: {
            ...card,
            id: "z",
            name: "Zoro",
            anime: "One Piece",
            category: "Manga"
          }
        })
      ]
    }
  });
  assert.match(
    normalizeWhitespace(search),
    normalizeWhitespace(/2 cards up for auction/)
  );
  assert.match(search, /role="status" class="sr-only"/);
  assert.match(search, /<header class="yk-market-heading">/);
  assert.equal((search.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 0);
  assert.doesNotMatch(search, /Vendre une carte|All active auctions/);
  assert.match(
    normalizeWhitespace(search),
    normalizeWhitespace(/<span>Manga<\/span>/)
  );
  assert.match(
    normalizeWhitespace(html),
    normalizeWhitespace(
      /aria-pressed="false"><span class="yk-filter-check"><\/span><span>Most popular<\/span>/
    )
  );
  assert.match(normalizeWhitespace(html), normalizeWhitespace(/>My auctions</));
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /matchesCardSearch\(query,\[a\.card\.name,a\.card\.anime\]\)/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(source),
    normalizeWhitespace(/terms\.every|const terms=/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /\[\["mine","Active"\],\["won","Won"\],\["sold","Completed"\]\]/
    )
  );
  assert.doesNotMatch(
    normalizeWhitespace(source),
    normalizeWhitespace(/"Vendues"/)
  );
  // One sidebar for both tabs; My auctions swaps the price sort for a Statut section.
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /\{section==="mine"&&\(?<CatalogueFilterSection title="Status">/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /\{section==="browse"&&\(?<CatalogueFilterSection title="Sort by">/
    )
  );
  // Same layout as Collection/Catalogue: the sidebar stays in normal page flow without its own scroll area.
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /<div className="yk-collection-layout">\s*<aside id="market-filters"/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/className="yk-market-filter-scroll"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /className="yk-collection-toolbar yk-market-toolbar-band"/
    )
  );
  const marketCss = readFileSync(path.join(root, "styles/market.css"), "utf8");
  const collectionCss = readFileSync(
    path.join(root, "styles/collection.css"),
    "utf8"
  );
  assert.doesNotMatch(
    normalizeWhitespace(collectionCss),
    normalizeWhitespace(/\.yk-collection-sidebar \{[^}]*position: sticky/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(marketCss),
    normalizeWhitespace(/\.yk-market-filter-scroll \{[^}]*overflow-y: auto/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(marketCss),
    normalizeWhitespace(/\.yk-market-sidebar \{[^}]*max-height:/)
  );
});

test("la recherche du marché filtre en mémoire par nom et franchise", () => {
  const source = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/const \[query,setQuery\]=useState\(""\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /matchesCardSearch\(query,\[a\.card\.name,a\.card\.anime\]\)/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/&&\(!rarity\|\|a\.card\.rarity===rarity\)/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/id="market-query" type="search" value=\{query\}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/No auctions match your search and filters/)
  );
  assert.ok(
    existsSync(
      path.join(root, "app/design-system/market-search-preview/page.tsx")
    )
  );
});

test("le Marché trie par favoris_count puis fin et identifiant", () => {
  const { compareMarketAuctions } = load("components/community-views.tsx");
  const auction = (id, popularity, remainingSeconds) => ({
    id,
    card,
    amount: 100,
    remaining: "",
    remainingSeconds,
    seller: "",
    bids: 0,
    popularity
  });
  const values = [
    auction("b", 900, 200),
    auction("z", 120, 50),
    auction("c", 900, 100),
    auction("a", 900, 100)
  ];
  assert.deepEqual(
    values
      .toSorted((a, b) => compareMarketAuctions(a, b, "popular"))
      .map(item => item.id),
    ["a", "c", "b", "z"]
  );
  const migration = readFileSync(
    path.join(root, "supabase/migrations/20261001000001_market_popularity.sql"),
    "utf8"
  );
  assert.match(migration, /'popularity',coalesce\(c\.favoris_count,0\)/);
  assert.doesNotMatch(migration, /join public\.auction_watchers/);
  assert.ok(
    existsSync(
      path.join(root, "app/design-system/market-popularity-preview/page.tsx")
    )
  );
});

test("la recherche multi-termes partage une sémantique ET entre Collection, Catalogue et Marché", () => {
  const { cardSearchTerms, matchesCardSearch } = load("lib/ui/card-search.ts");
  assert.deepEqual(
    [...cardSearchTerms("  LUFFY, One PIECE ")],
    ["luffy", "one", "piece"]
  );
  assert.equal(
    matchesCardSearch("one piece luffy", ["Monkey D. Luffy", "One Piece"]),
    true
  );
  assert.equal(
    matchesCardSearch("LUFFY ONE PIECE", ["Monkey D. Luffy", "One Piece"]),
    true
  );
  assert.equal(
    matchesCardSearch("one piece naruto", ["Monkey D. Luffy", "One Piece"]),
    false
  );
  const collection = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  const community = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  const cards = readFileSync(path.join(root, "lib/data/cards.ts"), "utf8");
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(
      /matchesCardSearch\(query,\[c\.name,c\.category,c\.anime\]\)/
    )
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /matchesCardSearch\(query,\[a\.card\.name,a\.card\.anime\]\)/
    )
  );
  assert.match(
    normalizeWhitespace(cards),
    normalizeWhitespace(/const terms\s*=\s*cardSearchTerms\(query\)/)
  );
  assert.match(
    normalizeWhitespace(cards),
    normalizeWhitespace(
      /\.rpc\("get_catalogue_cards_page",\s*\{[\s\S]*p_query:\s*terms\.join\(" "\)/
    )
  );
  assert.ok(
    existsSync(
      path.join(root, "app/design-system/multi-term-search-preview/page.tsx")
    )
  );
});

test("Phase 6 : détail d'enchère, solde, minute ajoutée, historique et issues", () => {
  const { AuctionView, presentAuction } = load(
    "components/community-views.tsx"
  );
  const base = {
    id: "a",
    card: { ...card, anime: "Spirit Realm" },
    amount: 120,
    remaining: "00:04:00",
    remainingSeconds: 240,
    seller: "Kitsune",
    bids: 2,
    nextBid: 130,
    minimumBid: 130,
    balance: 100,
    extended: true,
    history: [
      { id: "h1", name: "Oni", amount: 120, time: "14:32" },
      { id: "h2", name: "Moi", amount: 110, time: "14:30", mine: true }
    ]
  };
  const live = render(AuctionView, { auction: base, async onBid() {} });
  assert.match(live, />\+10 Karas<span>· 130 Karas<\/span>/);
  assert.match(live, /One minute has been added to the auction\./);
  assert.match(live, /Not enough Karas \(your balance: 100 Karas\)/);
  assert.match(
    live,
    /Oni<\/a><span class="text-ink-3"> · <\/span><span class="text-karas tabular-nums">120 Karas<\/span><span class="text-ink-3"> · <\/span><time[^>]*>14:32<\/time>/
  );
  assert.ok(
    live.indexOf("yk-auction-history") > live.indexOf("yk-auction-panel")
  );
  assert.match(
    render(AuctionView, {
      auction: { ...base, finished: true, status: "won" }
    }),
    /Auction won!/
  );
  assert.match(
    render(AuctionView, {
      auction: { ...base, finished: true, status: "lost", winner: "Oni" }
    }),
    /Auction lost[^]*Won by Oni/
  );
  const ownSale = { ...base, bids: 0, nextBid: undefined, status: "mine" };
  assert.equal(
    (
      render(AuctionView, { auction: ownSale, async onCancel() {} }).match(
        /Cancel listing/g
      ) ?? []
    ).length,
    2
  );
  const bidSale = render(AuctionView, {
    auction: { ...ownSale, bids: 1 },
    async onCancel() {}
  });
  assert.equal((bidSale.match(/Cancel listing/g) ?? []).length, 1);
  assert.match(
    bidSale,
    /can&#x27;t be canceled because a bid has already been placed/
  );
  const raw = {
    id: "a",
    card,
    amount: 120,
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    status: "active",
    seller: "Kitsune",
    sellerId: "s",
    buyerId: "x",
    bids: 2,
    watched: false,
    balance: 50,
    history: [
      {
        id: "h1",
        name: "Oni",
        amount: 120,
        createdAt: "2026-09-29T12:32:00Z",
        mine: false
      },
      {
        id: "h2",
        name: "Moi",
        amount: 110,
        createdAt: "2026-09-29T12:30:00Z",
        mine: true
      }
    ]
  };
  assert.equal(presentAuction(raw, "me").status, "outbid");
  assert.equal(presentAuction({ ...raw, status: "sold" }, "me").status, "lost");
  assert.equal(
    presentAuction({ ...raw, status: "sold", buyerId: "me" }, "me").status,
    "won"
  );
  assert.match(
    presentAuction(raw, "me").history[0].time,
    /^\d{2}:\d{2} [AP]M$/
  );
});

test("Mes enchères conserve les participations surenchéries exposées par list_auctions", () => {
  const { buildAuctionLists, presentAuction } = load(
    "components/community-views.tsx"
  );
  const raw = {
    id: "outbid",
    card,
    amount: 120,
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    status: "active",
    seller: "Kitsune",
    sellerId: "seller",
    buyerId: "rival",
    hasBid: true,
    bids: 2,
    watched: false
  };
  assert.equal(presentAuction(raw, "viewer").status, "outbid");
  assert.deepEqual(
    buildAuctionLists([raw], "viewer").mine.map(item => item.id),
    ["outbid"]
  );
  assert.deepEqual(
    buildAuctionLists([{ ...raw, hasBid: false }], "viewer").mine,
    []
  );
  const migration = readFileSync(
    path.join(
      root,
      "supabase/migrations/20261001000000_auction_participation.sql"
    ),
    "utf8"
  );
  assert.match(migration, /where b\.bidder_id=player_id/);
  assert.match(
    migration,
    /bids_bidder_auction_idx on public\.bids\(bidder_id,auction_id\)/
  );
  assert.ok(
    existsSync(
      path.join(
        root,
        "app/design-system/auction-participation-preview/page.tsx"
      )
    )
  );
});

test("Phase 6 : la mise en vente confirme le verrouillage et signale la réinitialisation d'image", () => {
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /Carte mise aux enchères — verrouillée jusqu’à la fin de la vente/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /selected\.customImageUrl&&\(?<li>L’image personnalisée de cette carte sera réinitialisée\.<\/li>/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(
      /\[\["15","15 min"\],\["30","30 min"\],\["60","1 h"\],\["240","4 h"\],\["720","12 h"\],\["1440","24 h"\]\]/
    )
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/useState\("10"\)/)
  );
});

test("l’inscription vérifie le pseudo après debounce sans remplacer la validation de soumission", () => {
  const form = readFileSync(
    path.join(root, "components/auth-form.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(form),
    normalizeWhitespace(/window\.setTimeout\(async \(\) => \{/)
  );
  assert.match(normalizeWhitespace(form), normalizeWhitespace(/\}, 450\)/));
  assert.match(
    normalizeWhitespace(form),
    normalizeWhitespace(/pseudoValidationError\(pseudo\.trim\(\)\)/)
  );
  assert.match(
    normalizeWhitespace(form),
    normalizeWhitespace(/pseudoRequest\.current \+= 1/)
  );
  assert.match(
    normalizeWhitespace(form),
    normalizeWhitespace(/if \(pseudoRequest\.current !== request\) return/)
  );
  assert.match(normalizeWhitespace(form), normalizeWhitespace(/Available/));
  assert.match(normalizeWhitespace(form), normalizeWhitespace(/Already taken/));
  assert.doesNotMatch(
    normalizeWhitespace(form),
    normalizeWhitespace(/disabled=\{[^}]*pseudoAvailability/)
  );
  const actions = readFileSync(path.join(root, "app/auth/actions.ts"), "utf8");
  assert.match(
    normalizeWhitespace(actions),
    normalizeWhitespace(
      /export async function checkPseudoAvailabilityWhileTyping/
    )
  );
  assert.match(
    normalizeWhitespace(actions),
    normalizeWhitespace(
      /return await checkPseudoAvailability\(supabase, cleanPseudo\)/
    )
  );
  assert.match(
    normalizeWhitespace(actions),
    normalizeWhitespace(
      /export async function signUp[\s\S]*const pseudoAvailable = await checkPseudoAvailability\(supabase, input\.pseudo\)/
    )
  );
});

test("les notifications connues ont un texte et une redirection, les inconnues un repli sûr", () => {
  const source = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  const model = readFileSync(
    path.join(root, "lib/data/notifications.ts"),
    "utf8"
  );
  for (const type of [
    "wishlist_card_on_auction",
    "friend_request",
    "outbid",
    "trade_offer_received",
    "trade_counter_offer_received",
    "trade_offer_accepted",
    "trade_offer_declined",
    "trade_offer_cancelled",
    "auction_won",
    "auction_sold",
    "auction_chat_mention",
    "achievement_completed"
  ]) {
    assert.match(model, new RegExp(type));
  }
  assert.match(source, /on your wishlist is now up for auction. Take a look!/);
  assert.match(source, /You've been outbid on/);
  assert.match(source, /You won/);
  assert.match(source, /You sold/);
  assert.match(source, /sent you a trade offer/);
  assert.match(source, /sent you a counteroffer/);
  assert.match(source, /accepted your trade offer/);
  assert.match(source, /declined your trade offer/);
  assert.match(source, /canceled their trade offer/);
  assert.match(source, /New activity/);
  for (const glyph of ["⇄", "↺", "✓", "×"])
    assert.match(source, new RegExp(glyph));
  assert.match(source, /New achievement/);
  assert.match(source, /sent you a friend request/);
  for (const href of ["/marche/", "/amis", "/echanges?offre=", "/succes#"]) {
    assert.match(source, new RegExp(href.replace("?", "\\?")));
  }
  const { notificationItem } = load("components/topbar.tsx");
  const unknown = notificationItem({
    id: "unknown",
    type: "future_type",
    referenceId: "ref",
    readAt: null,
    createdAt: "2026-10-05T00:00:00Z",
    cardName: null,
    actorPseudo: null,
    achievementName: null
  });
  assert.equal(unknown.title, "New activity");
  assert.equal(unknown.text, "New activity is available.");
  const sold = notificationItem({
    id: "sold",
    type: "auction_sold",
    referenceId: "auction",
    readAt: null,
    createdAt: "2026-10-05T00:00:00Z",
    cardName: "Kitsune",
    actorPseudo: null,
    achievementName: null,
    karaAmount: 1250
  });
  assert.equal(sold.title, "Card sold");
  assert.equal(sold.text, "You sold Kitsune for 1,250 Karas.");
  assert.equal(sold.kind, "sold");
  const mention = notificationItem({
    id: "mention",
    type: "auction_chat_mention",
    referenceId: "auction",
    readAt: null,
    createdAt: "2026-10-05T00:00:00Z",
    cardName: "Kitsune",
    actorPseudo: "Bob",
    achievementName: null
  });
  assert.equal(mention.text, "Bob mentioned you in the chat for Kitsune.");
  assert.equal(mention.href, "/marche/auction#chat-enchere");
  assert.equal(mention.kind, "mention");
});

test("les notifications se relisent à l'ouverture du panneau et au retour sur l'onglet", () => {
  const hook = readFileSync(
    path.join(root, "hooks/use-notification-feed.ts"),
    "utf8"
  );
  const topbar = readFileSync(path.join(root, "components/topbar.tsx"), "utf8");
  const community = readFileSync(
    path.join(root, "components/community-views.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(hook),
    normalizeWhitespace(
      /startVisiblePolling\(\(\) => void refresh\(\), POLL_INTERVAL_MS\)/
    )
  );
  const polling = readFileSync(
    new URL("../lib/ui/visible-polling.ts", import.meta.url),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(polling),
    normalizeWhitespace(/addEventListener\("visibilitychange"/)
  );
  assert.match(
    normalizeWhitespace(polling),
    normalizeWhitespace(/removeEventListener\("visibilitychange"/)
  );
  assert.match(
    normalizeWhitespace(hook),
    normalizeWhitespace(/inFlight\.current\) return/)
  );
  assert.match(
    normalizeWhitespace(topbar),
    normalizeWhitespace(
      /setPanel\("notifications"\);if\(notifications\)onRefreshNotifications\?\.\(\);else void feed\.refresh\(\);/
    )
  );
  assert.match(
    normalizeWhitespace(community),
    normalizeWhitespace(
      /onRefreshNotifications=\{\(\)=>void feed\.refresh\(\)\}/
    )
  );
  for (const source of [topbar, community])
    assert.doesNotMatch(
      normalizeWhitespace(source),
      normalizeWhitespace(/getNotifications\(\)/)
    );
  assert.ok(
    existsSync(
      path.join(root, "app/design-system/notification-refresh-preview/page.tsx")
    )
  );
});

test("les pages Paramètres et Admin transmettent le solde de Karas à la Topbar", () => {
  const session = readFileSync(path.join(root, "lib/auth/session.ts"), "utf8");
  const settings = readFileSync(
    path.join(root, "app/parametres/page.tsx"),
    "utf8"
  );
  const admin = readFileSync(
    path.join(root, "app/admin/cards/page.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(session),
    normalizeWhitespace(/export async function getCurrentKarasBalance/)
  );
  assert.match(
    normalizeWhitespace(session),
    normalizeWhitespace(/rpc\("get_game_info"\)/)
  );
  assert.match(
    normalizeWhitespace(settings),
    normalizeWhitespace(/getCurrentKarasBalance\(\)/)
  );
  assert.match(
    normalizeWhitespace(settings),
    normalizeWhitespace(/<Topbar view="settings"[\s\S]{0,200}karas=\{karas\}/)
  );
  assert.match(
    normalizeWhitespace(admin),
    normalizeWhitespace(/getCurrentKarasBalance\(client\)/)
  );
  assert.match(
    normalizeWhitespace(admin),
    normalizeWhitespace(/<Topbar view="admin"[\s\S]{0,200}karas=\{karas\}/)
  );
});

test("les paramètres permettent de changer le mot de passe après vérification de l’actuel", () => {
  const settings = readFileSync(
    path.join(root, "components/settings.tsx"),
    "utf8"
  );
  assert.match(settings, /name="currentPassword"/);
  assert.match(settings, /name="password"/);
  assert.match(settings, /name="confirmPassword"/);
  assert.match(settings, /useActionState\(changePassword/);
});

test("tri de la Collection : rareté par défaut, dates, nom français et ordre stable", () => {
  const {
    sortCollection,
    COLLECTION_SORTS,
    DEFAULT_COLLECTION_SORT,
    isCollectionSort
  } = load("lib/ui/collection-sort.ts");
  const make = (instanceId, name, rarity, shiny, obtainedAt) => ({
    ...card,
    instanceId,
    name,
    rarity,
    shiny,
    obtainedAt
  });
  const cards = [
    make("a", "Écho", "SR", false, "2026-03-01T10:00:00Z"),
    make("b", "akira", "LR", false, "2026-01-15T10:00:00Z"),
    make("c", "Zorro", "SSR", true, "2026-05-10T10:00:00Z"),
    make("d", "Mochi", "SSR", false, "2026-05-10T10:00:00Z"),
    make("e", "Bashō", "C", false, "2026-07-01T10:00:00Z"),
    make("f", "Kitsune", "R", true, "2025-12-31T10:00:00Z")
  ];
  const names = sort =>
    sortCollection(cards, sort)
      .map(item => item.name)
      .join(",");
  assert.equal(DEFAULT_COLLECTION_SORT, "rarity");
  assert.equal(
    COLLECTION_SORTS.map(option => option.label).join(" | "),
    "Rareté | Plus récentes | Plus anciennes | Nom (A → Z)"
  );
  assert.equal(names("rarity"), "akira,Zorro,Mochi,Écho,Kitsune,Bashō");
  assert.equal(names("recent"), "Bashō,Zorro,Mochi,Écho,akira,Kitsune");
  assert.equal(names("oldest"), "Kitsune,akira,Écho,Zorro,Mochi,Bashō");
  assert.equal(names("name"), "akira,Bashō,Écho,Kitsune,Mochi,Zorro");
  assert.equal(cards[0].name, "Écho", "le tri ne modifie pas le tableau reçu");
  const twins = [
    make("z", "Double", "C", false, "2026-01-01T00:00:00Z"),
    make("y", "Double", "C", false, "2026-01-01T00:00:00Z")
  ];
  assert.equal(
    sortCollection(twins, "name")
      .map(item => item.instanceId)
      .join(),
    "y,z"
  );
  assert.ok(isCollectionSort("oldest"));
  assert.ok(!isCollectionSort("franchise"));
  assert.ok(!isCollectionSort(null));
  const source = readFileSync(
    path.join(root, "components/collection.tsx"),
    "utf8"
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/sortCollection\(cards\.filter\(/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/setSort\(e\.target\.value\);setPage\(1\);/)
  );
  assert.doesNotMatch(
    normalizeWhitespace(source),
    normalizeWhitespace(/yk-sort-placeholder|Tri non disponible/)
  );
  const css = readFileSync(path.join(root, "styles/collection.css"), "utf8");
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-sort-control \{[^}]*white-space: nowrap;/),
    "les libellés longs restent sur une ligne"
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-collection-toolbar-actions > :not\(dialog\) \{[^}]*width: calc\(var\(--spacing\) \* 50\);/
    ),
    "la largeur partagée des actions ne change pas"
  );
});
