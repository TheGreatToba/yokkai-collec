import assert from "node:assert/strict";
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
      Response,
      ...globals,
      require: name =>
        name in mocks ? mocks[name] : name.endsWith(".css") ? {} : require(name)
    }
  );
  return exports;
}
const { cardCinematicDocument } = load("lib/ui/card-cinematic-document.ts");
const card = {
  id: "card",
  instanceId: "instance",
  name: "Actual card",
  category: "ANIME/MANGA",
  anime: "Naruto",
  image: "/assets/card.png",
  rarity: "SSR"
};
function descendants(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(descendants)
  ];
}
function hooks() {
  const states = [],
    effects = [],
    refs = [];
  let index = 0;
  return {
    states,
    effects,
    refs,
    reset() {
      index = 0;
      effects.length = 0;
    },
    react: {
      ...React,
      useState(initial) {
        const position = index++;
        if (!(position in states))
          states[position] =
            typeof initial === "function" ? initial() : initial;
        return [
          states[position],
          value => {
            states[position] =
              typeof value === "function" ? value(states[position]) : value;
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

test("live SSR/LR document endpoint serves validated inert templates in production, with no database access", async () => {
  const reads = [];
  const { GET } = load(
    "app/api/card-cinematics/route.ts",
    {
      "node:fs/promises": {
        readFile: async file => {
          reads.push(file);
          return read("data/card-cinematics/ssr.html");
        }
      },
      "@/lib/ui/card-cinematic-document": { cardCinematicDocument }
    },
    { process: { env: { NODE_ENV: "production" }, cwd: () => "/workspace" } }
  );
  const request = (rarity, extra = {}) =>
    new Request(
      `https://yokkai-collec.com/api/card-cinematics?${new URLSearchParams({
        rarity,
        name: "Actual <card>",
        category: "ANIME/MANGA",
        image: "https://example.com/card.png",
        ...extra
      })}`
    );
  for (const rarity of ["C", "LR", "../../secret", "lr", ""]) {
    assert.equal((await GET(request(rarity))).status, 400);
  }
  assert.equal(reads.length, 0);
  assert.equal(
    (await GET(request("LR", { name: "x".repeat(9000) }))).status,
    400
  );
  assert.equal(reads.length, 0);
  for (const rarity of ["SSR", "SSR"]) {
    const response = await GET(request(rarity));
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "text/plain; charset=utf-8"
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    const html = await response.text();
    assert.match(html, /sandbox|connect-src 'none'/);
    assert.match(html, /Actual \\u003ccard\\u003e/);
    assert.match(html, new RegExp(`"rank":"${rarity}"`));
    assert.match(html, /setRate\(1\.4\)/);
    assert.match(html, /YOKKAI_CARD_COMPLETE/);
  }
  assert.equal(reads.length, 1, "the fixed SSR template is cached");
  for (const image of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "http://example.com/card.png"
  ]) {
    const response = await GET(request("SSR", { image }));
    assert.equal(response.status, 400);
    assert.equal(await response.text(), "The cinematic is unavailable.");
  }
  assert.doesNotMatch(
    read("app/api/card-cinematics/route.ts"),
    /supabase|auth\.get|\.rpc\(/i
  );
});

test("failed immutable template reads can be retried without leaking filesystem errors", async () => {
  let reads = 0;
  const { GET } = load(
    "app/api/card-cinematics/route.ts",
    {
      "node:fs/promises": {
        readFile: async () => {
          if (++reads === 1) throw Error("secret filesystem path");
          return read("data/card-cinematics/ssr.html");
        }
      },
      "@/lib/ui/card-cinematic-document": { cardCinematicDocument }
    },
    { process: { cwd: () => "/workspace" } }
  );
  const request = new Request(
    "https://yokkai-collec.com/api/card-cinematics?rarity=SSR&image=https://example.com/card.png"
  );
  const failure = await GET(request);
  assert.equal(failure.status, 400);
  assert.doesNotMatch(await failure.text(), /secret|filesystem/);
  assert.equal((await GET(request)).status, 200);
  assert.equal(reads, 2);
});

test("released player uses the public route while the default preview stays development-only", async () => {
  const state = hooks();
  let requested;
  const { LocalCardCinematic } = load(
    "components/local-card-cinematic.tsx",
    { react: state.react },
    {
      process: { env: { NODE_ENV: "production" } },
      AbortController,
      window: {
        location: { origin: "https://yokkai-collec.com" },
        setTimeout: () => 1,
        clearTimeout() {}
      },
      fetch: async url => {
        requested = url;
        return { ok: true, text: async () => "<html></html>" };
      }
    }
  );
  assert.equal(LocalCardCinematic({ card }), null);
  state.reset();
  const tree = descendants(
    LocalCardCinematic({
      card,
      controls: false,
      productionEnabled: true,
      onContinue() {}
    })
  );
  const cleanup = state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(requested.startsWith("/api/card-cinematics?"));
  assert.equal(
    new URL(requested, "https://yokkai-collec.com").searchParams.get("image"),
    "https://yokkai-collec.com/assets/card.png"
  );
  assert.equal(tree.filter(node => node.type === "button").length, 0);
  cleanup();
  const wrapper = load("components/card-cinematic.tsx", {
    "@/components/local-card-cinematic": { LocalCardCinematic: "Player" },
    "@/components/lr-card-reveal": { LrCardReveal: "NativeLR" }
  }).CardCinematic({ card, onContinue() {} });
  assert.equal(wrapper.type, "Player");
  assert.equal(wrapper.props.controls, false);
  assert.equal(wrapper.props.productionEnabled, true);
});

test("released real-pack reveals use final SSR/LR without a new reward call and replays never progress", () => {
  for (const rarity of ["SSR", "LR"]) {
    const state = hooks();
    let progress = 0;
    const timers = [];
    const { BoosterReveal } = load(
      "components/boosters.tsx",
      {
        react: state.react,
        "next/dynamic": {
          default: factory =>
            factory.toString().includes('components/card-cinematic"')
              ? "ReleasedCinematic"
              : "OtherDynamic"
        },
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
        process: { env: { NODE_ENV: "production" } },
        window: {
          setTimeout: (fn, ms) => {
            timers.push({ fn, ms });
            return 1;
          },
          clearTimeout() {}
        },
        clearTimeout() {}
      }
    );
    const props = {
      cards: [{ ...card, rarity }],
      revealed: 0,
      onReveal: () => progress++,
      onReturn() {}
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
    assert.equal(timers.length, 0);
    const modal = render().find(
      node => node.type === "Modal" && node.props.open
    );
    assert.ok(modal.props.className.includes("yk-lr-file-modal"));
    assert.equal(modal.props.children.type, "ReleasedCinematic");
    modal.props.children.props.onContinue();
    assert.equal(state.states[2], null);
    assert.equal(progress, 0);
    props.revealed = 1;
    state.states[0] = false;
    const summary = render();
    const replay = summary.find(
      node =>
        node.type === "Button" &&
        React.Children.toArray(node.props.children)
          .join("")
          .includes("Replay cinematic:")
    );
    assert.ok(replay);
    replay.props.onClick();
    render()
      .find(node => node.type === "Modal" && node.props.open)
      .props.children.props.onContinue();
    assert.equal(progress, 0);
  }
  assert.match(
    read("components/boosters.tsx"),
    /<CardCinematic[^>]*card=\{spot\}/
  );
  assert.doesNotMatch(
    read("components/card-cinematic.tsx"),
    /\.rpc\(|openPack|createClient/
  );
});
