import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      }
    }).outputText,
    {
      exports,
      URL,
      URLSearchParams,
      ...globals,
      require: name =>
        name in mocks ? mocks[name] : name.endsWith(".css") ? {} : require(name)
    }
  );
  return exports;
}
const { cardCinematicDocument } = load("lib/ui/card-cinematic-document.ts");
const assets = Object.fromEntries(
  ["LR", "SSR"].map(rarity => [
    rarity,
    read(`data/card-cinematics/${rarity.toLowerCase()}.html`).replaceAll(
      "\r\n",
      "\n"
    )
  ])
);
const params = (extra = {}) =>
  new URLSearchParams({
    name: "Madara Uchiha",
    category: "ANIME/MANGA",
    license: "Naruto",
    image: "http://localhost:3000/assets/premium-examples/bbdou-card-1.png",
    ...extra
  });
const documentFor = (rarity, extra) =>
  cardCinematicDocument(
    assets[rarity],
    params(extra),
    "http://localhost:3000",
    rarity
  );

test("final user-supplied SSR/LR assets retain their original bytes, timing and reduced-motion visuals", () => {
  const hashes = {
    LR: "d9a4637cfe388325825f6008b61b45e224ece7e2c0ab9b473501b0167fbabb87",
    SSR: "8b8e71ba5930332bd431749c04daa65b490a081df47569402174c43126cae4f7"
  };
  for (const rarity of ["LR", "SSR"]) {
    assert.equal(
      createHash("sha256").update(assets[rarity]).digest("hex"),
      hashes[rarity]
    );
    const html = documentFor(rarity);
    assert.match(html, /<html lang="en" class="yokkai-wait-card">/);
    assert.match(html, new RegExp(`aria-label="Yokkai ${rarity} card reveal"`));
    assert.ok(
      html.includes(assets[rarity].match(/<style>[\s\S]*?<\/style>/)[0])
    );
    assert.match(html, /prefers-reduced-motion:\s*reduce/);
    assert.match(html, /--intro-total:4\.30s!important/);
    assert.doesNotMatch(
      html,
      /allowedYokkaiOrigins|event\.data\?\.type==='YOKKAI_SHOW_CARD'|const injectedCardElement/
    );
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /form-action 'none'/);
    assert.match(html, /setTimeout\(\(\)=>finish\(false\),5000\)/);
  }
  assert.match(documentFor("LR"), /--card-hover-start:16\.34s!important/);
  assert.match(documentFor("SSR"), /float-no-stall 2\.5s/);
});

test("only actual app fields are injected, escaped as JSON, with the site's rarity border colors", () => {
  for (const rarity of ["LR", "SSR"]) {
    const name = '</script><img src=x onerror="alert(1)"> & \u2028';
    const html = documentFor(rarity, { name });
    const injected = html.match(/const hostCard=([^\n]+);/)[1];
    const card = JSON.parse(injected);
    assert.equal(card.name, name);
    assert.equal(card.category, "ANIME/MANGA");
    assert.equal(card.license, "Naruto");
    assert.equal(card.rank, rarity);
    assert.equal(card.borderColor, rarity === "LR" ? "#E8C26A" : "#FF4FB6");
    assert.equal(card.borderImage, undefined);
    assert.match(injected, /\\u003c/);
    assert.doesNotMatch(injected, /<\/script>/);
  }
  for (const image of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///secret",
    "http://remote.example/card.png",
    "https://user:pass@example.com/a.png",
    "bad"
  ]) {
    assert.throws(() => documentFor("LR", { image }));
  }
  assert.throws(() => documentFor("LR", { image: "" }));
  assert.throws(() => documentFor("LR", { name: "x".repeat(241) }));
  assert.throws(() =>
    cardCinematicDocument(assets.LR, params(), "http://localhost:3000", "C")
  );
});

test("startup waits for artwork, never shows a demo on failure, and only accepts parent pause/status messages", async () => {
  for (const succeeds of [true, false]) {
    const script = [
      ...documentFor("SSR").matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)
    ].at(-1)[1];
    const calls = [];
    const messages = [];
    const parent = { postMessage: (...args) => messages.push(args) };
    let listener;
    vm.runInNewContext(script, {
      parent,
      prefetchSiteImage: async () => succeeds,
      window: {
        addEventListener: (type, fn) => {
          assert.equal(type, "message");
          listener = fn;
        },
        setYokkaiCard: async (...args) => {
          calls.push(args);
          return true;
        }
      },
      document: {
        documentElement: {
          classList: { toggle: (...args) => calls.push(args) }
        }
      }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(
      messages[0][0].type,
      succeeds ? "YOKKAI_CARD_READY" : "YOKKAI_CARD_ERROR"
    );
    assert.equal(messages[0][1], "http://localhost:3000");
    assert.equal(calls.length, succeeds ? 1 : 0);
    if (succeeds) {
      assert.equal(calls[0][0].rank, "SSR");
      assert.equal(calls[0][1].replay, false);
    }
    const count = calls.length;
    const event = {
      source: parent,
      origin: "http://localhost:3000",
      data: { type: "yokkai-card-pause", paused: true }
    };
    listener({ ...event, source: {} });
    listener({ ...event, origin: "https://evil.example" });
    listener({
      ...event,
      data: { type: "YOKKAI_SHOW_CARD", card: { name: "evil" } }
    });
    listener({ ...event, data: { type: "yokkai-card-pause", paused: "yes" } });
    assert.equal(calls.length, count);
    listener(event);
    assert.equal(calls.at(-1)[0], "preview-paused");
    assert.equal(calls.at(-1)[1], true);
    listener({ ...event, data: { type: "yokkai-card-status" } });
    assert.equal(messages.length, 2);
  }
});

test("document routing is development-only and asset selection cannot escape the fixed SSR/LR allowlist", async () => {
  const reads = [];
  const mocks = {
    "node:fs/promises": {
      readFile: async file => {
        reads.push(file);
        return /ssr\.html$/.test(file) ? assets.SSR : assets.LR;
      }
    },
    "@/lib/ui/card-cinematic-document": { cardCinematicDocument }
  };
  const route = env =>
    load("app/design-system/card-cinematics/document/route.ts", mocks, {
      process: { env: { NODE_ENV: env }, cwd: () => "/workspace" },
      Response
    });
  const request = rarity =>
    new Request(
      `http://localhost:3000/design-system/card-cinematics/document?${params({ rarity })}`
    );
  for (const environment of ["production", "test"]) {
    assert.equal((await route(environment).GET(request("LR"))).status, 404);
  }
  assert.equal(reads.length, 0);
  for (const rarity of ["../../secret", "C", "", "lr"]) {
    assert.equal((await route("development").GET(request(rarity))).status, 400);
  }
  assert.equal(reads.length, 0);
  for (const rarity of ["SSR", "LR"]) {
    const response = await route("development").GET(request(rarity));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.headers.get("content-type"),
      "text/plain; charset=utf-8"
    );
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(
      reads.at(-1).replaceAll("\\", "/"),
      new RegExp(`/data/card-cinematics/${rarity.toLowerCase()}\\.html$`)
    );
  }
});

function hooks() {
  const states = [];
  const effects = [];
  const refs = [];
  let index = 0;
  return {
    states,
    effects,
    refs,
    reset: () => {
      index = 0;
      effects.length = 0;
    },
    react: {
      ...React,
      useState: initial => {
        const position = index++;
        if (!(position in states))
          states[position] =
            typeof initial === "function" ? initial() : initial;
        return [
          states[position],
          next => {
            states[position] =
              typeof next === "function" ? next(states[position]) : next;
          }
        ];
      },
      useEffect: fn => effects.push(fn),
      useRef: initial => {
        const ref = { current: initial };
        refs.push(ref);
        return ref;
      },
      useCallback: fn => fn
    }
  };
}
function descendants(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(descendants)
  ];
}
const card = {
  name: "Hiromi Higuruma",
  image: "/assets/premium-examples/bbdou-card-7.png",
  rarity: "SSR",
  category: "ANIME/MANGA",
  anime: "JUJUTSU KAISEN"
};

test("the sandbox player resolves real relative images and reports document failures without blocking Continue", async () => {
  const state = hooks();
  let requested;
  let continued = 0;
  const { LocalCardCinematic } = load(
    "components/local-card-cinematic.tsx",
    { react: state.react },
    {
      process: { env: { NODE_ENV: "development" } },
      AbortController,
      window: {
        location: { origin: "http://localhost:3000" },
        setTimeout: () => 1,
        clearTimeout: () => {}
      },
      fetch: async url => {
        requested = url;
        return { ok: false };
      }
    }
  );
  LocalCardCinematic({ card });
  const cleanup = state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  const query = new URL(requested, "http://localhost:3000").searchParams;
  assert.equal(
    query.get("image"),
    "http://localhost:3000/assets/premium-examples/bbdou-card-7.png"
  );
  assert.equal(query.get("rarity"), "SSR");
  assert.equal(query.get("license"), "JUJUTSU KAISEN");
  assert.equal(state.states[1], "error");
  state.reset();
  const tree = descendants(
    LocalCardCinematic({ card, onContinue: () => continued++ })
  );
  tree
    .find(node => node.type === "button" && node.props.children === "Continue")
    .props.onClick();
  assert.equal(continued, 1);
  tree
    .find(
      node =>
        node.type === "button" && node.props.children === "Replay cinematic"
    )
    .props.onClick();
  assert.equal(state.states[4], 1);
  cleanup();
});

test("replay only remounts the frame; pause/ready messages are scoped to its opaque sandbox", () => {
  const state = hooks();
  state.states.push("<html></html>", "ready", 0, false, 0);
  const listeners = [];
  let removed = 0;
  const messages = [];
  const { LocalCardCinematic } = load(
    "components/local-card-cinematic.tsx",
    { react: state.react },
    {
      process: { env: { NODE_ENV: "development" } },
      window: {
        setTimeout: () => 1,
        clearTimeout: () => {},
        addEventListener: (type, fn) => listeners.push(fn),
        removeEventListener: () => removed++
      }
    }
  );
  const render = () => {
    state.reset();
    return descendants(LocalCardCinematic({ card }));
  };
  const tree = render();
  const iframe = tree.find(node => node.type === "iframe");
  assert.equal(iframe.props.sandbox, "allow-scripts");
  assert.equal(iframe.props.src, undefined);
  assert.equal(iframe.props.tabIndex, -1);
  const child = { postMessage: (...args) => messages.push(args) };
  state.refs.at(-1).current = { contentWindow: child };
  const cleanup = state.effects[1]();
  listeners[0]({
    source: {},
    origin: "null",
    data: { type: "YOKKAI_CARD_ERROR" }
  });
  listeners[0]({
    source: child,
    origin: "https://evil.example",
    data: { type: "YOKKAI_CARD_ERROR" }
  });
  assert.equal(state.states[1], "ready");
  tree
    .find(
      node =>
        node.type === "button" && node.props.children === "Pause animations"
    )
    .props.onClick();
  assert.equal(messages[0][0].paused, true);
  iframe.props.onLoad();
  assert.equal(messages[1][0].type, "yokkai-card-status");
  listeners[0]({
    source: child,
    origin: "null",
    data: { type: "YOKKAI_CARD_ERROR" }
  });
  assert.equal(state.states[1], "error");
  tree
    .find(
      node =>
        node.type === "button" && node.props.children === "Replay cinematic"
    )
    .props.onClick();
  assert.equal(state.states[1], "loading");
  assert.equal(state.states[2], 1);
  assert.equal(state.states[3], false);
  assert.notEqual(
    render().find(node => node.type === "iframe").key,
    iframe.key
  );
  cleanup();
  assert.equal(removed, 1);
  assert.doesNotMatch(
    read("components/local-card-cinematic.tsx"),
    /\.rpc\(|openPack|onReveal|createClient/
  );
});

test("SSR opt-in opens the cinematic without progressing or changing production timings", () => {
  for (const environment of ["development", "production"]) {
    const state = hooks();
    const timers = [];
    let progress = 0;
    const { BoosterReveal } = load(
      "components/boosters.tsx",
      {
        react: state.react,
        "next/dynamic": { default: () => "Cinematic" },
        "next/link": { default: "Link" },
        "@/components/ambient-glow": { AmbientGlow: "AmbientGlow" },
        "@/components/referral-reminder": {},
        "@/lib/ui/pack-opening": {},
        "@/components/card-sharing": {},
        "@/components/ui": {
          Button: "Button",
          Modal: "Modal",
          StatusPill: "StatusPill"
        },
        "@/components/yokai-card": {
          CardBack: "CardBack",
          YokaiCard: "YokaiCard"
        },
        "@/lib/ui/animations": {}
      },
      {
        process: { env: { NODE_ENV: environment } },
        window: {
          setTimeout: (fn, ms) => {
            timers.push(ms);
            return 1;
          }
        }
      }
    );
    const props = {
      finalCinematics: true,
      cards: [{ ...card, id: "local", instanceId: "local-copy" }],
      revealed: 0,
      onReveal: () => progress++,
      onReturn: () => {}
    };
    const render = () => {
      state.reset();
      return descendants(BoosterReveal(props));
    };
    render()
      .find(
        node =>
          node.type === "button" &&
          node.props["aria-label"] === "Reveal card 1 of 1"
      )
      .props.onClick();
    assert.equal(progress, 0);
    if (environment === "development") {
      assert.equal(state.states[2], props.cards[0]);
      assert.deepEqual(timers, []);
      const modal = render().find(
        node => node.type === "Modal" && node.props.open
      );
      assert.equal(modal.props.children.type, "Cinematic");
      modal.props.children.props.onContinue();
      assert.equal(state.states[2], null);
      assert.equal(progress, 0);
    } else {
      assert.equal(state.states[2], null);
      assert.deepEqual(timers, [3200]);
    }
  }
  assert.match(
    read("components/boosters.tsx"),
    /finalCinematics=\{process\.env\.NODE_ENV === "development"\}/
  );
});
