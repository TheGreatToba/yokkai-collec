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
      ...globals,
      require: name =>
        name in mocks ? mocks[name] : name.endsWith(".css") ? {} : require(name)
    }
  );
  return exports;
}
const { cardCinematicDocument } = load("lib/ui/card-cinematic-document.ts");
async function playback(rarity, reduced = false) {
  const html = cardCinematicDocument(
    read(`data/card-cinematics/${rarity.toLowerCase()}.html`),
    new URLSearchParams({
      name: "Actual card",
      image: "https://example.com/card.png"
    }),
    "http://localhost:3000",
    rarity
  );
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(
    -1
  )[1];
  const messages = [];
  const animations = [{ playbackRate: 1 }, { playbackRate: 1 }];
  const frames = [];
  const parent = { postMessage: data => messages.push(data.type) };
  let listener;
  vm.runInNewContext(script, {
    parent,
    prefetchSiteImage: async () => true,
    document: {
      getAnimations: () => animations,
      documentElement: { classList: { toggle() {} } }
    },
    window: {
      addEventListener: (type, fn) => {
        listener = fn;
      },
      setYokkaiCard: async () => true,
      matchMedia: () => ({ matches: reduced }),
      requestAnimationFrame: fn => frames.push(fn)
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  let time = 0;
  return {
    animations,
    messages,
    frames,
    tick(ms) {
      time += ms;
      assert.ok(frames.length);
      frames.shift()(time);
    },
    pause(paused, origin = "http://localhost:3000") {
      listener({
        source: parent,
        origin,
        data: { type: "yokkai-card-pause", paused }
      });
    }
  };
}

test("only the introduction is accelerated; both rarities finish once after the actual reveal", async () => {
  for (const [rarity, remaining] of [
    ["SSR", 5920],
    ["LR", 13380]
  ]) {
    const player = await playback(rarity);
    assert.deepEqual(player.messages, ["YOKKAI_CARD_READY"]);
    assert.ok(
      player.animations.every(animation => animation.playbackRate === 1.4)
    );
    player.tick(0);
    player.tick(3000);
    assert.ok(
      player.animations.every(animation => animation.playbackRate === 1.4)
    );
    player.tick(72);
    assert.ok(
      player.animations.every(animation => animation.playbackRate === 1)
    );
    player.tick(remaining);
    assert.deepEqual(player.messages, [
      "YOKKAI_CARD_READY",
      "YOKKAI_CARD_COMPLETE"
    ]);
    assert.equal(player.frames.length, 0);
  }
});

test("the completion clock respects pause and ignores untrusted pause messages", async () => {
  const player = await playback("SSR");
  player.tick(0);
  player.pause(true);
  player.tick(20000);
  assert.deepEqual(player.messages, ["YOKKAI_CARD_READY"]);
  player.pause(false, "https://evil.example");
  player.tick(20000);
  assert.deepEqual(player.messages, ["YOKKAI_CARD_READY"]);
  player.pause(false);
  player.tick(3072);
  player.tick(5920);
  assert.equal(player.messages.at(-1), "YOKKAI_CARD_COMPLETE");
});

test("reduced motion keeps native static visuals and advances after a short hold", async () => {
  const player = await playback("LR", true);
  assert.ok(player.animations.every(animation => animation.playbackRate === 1));
  player.tick(0);
  player.tick(699);
  assert.deepEqual(player.messages, ["YOKKAI_CARD_READY"]);
  player.tick(1);
  assert.equal(player.messages.at(-1), "YOKKAI_CARD_COMPLETE");
});

function descendants(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(descendants)
  ];
}
test("buttonless player supports click, keyboard and trusted completion without double progress", () => {
  for (const action of ["click", "keyboard", "complete"]) {
    const refs = [];
    const effects = [];
    let index = 0;
    let receive;
    let continued = 0;
    const child = {};
    const states = ["<html></html>", "ready", 0, false, 0];
    const { LocalCardCinematic } = load(
      "components/local-card-cinematic.tsx",
      {
        react: {
          ...React,
          useState: () => [states[index++], () => {}],
          useRef: value => {
            const ref = { current: value };
            refs.push(ref);
            return ref;
          },
          useEffect: fn => effects.push(fn)
        }
      },
      {
        process: { env: { NODE_ENV: "development" } },
        window: {
          setTimeout: () => 1,
          clearTimeout() {},
          addEventListener: (type, fn) => {
            receive = fn;
          },
          removeEventListener() {}
        }
      }
    );
    const tree = descendants(
      LocalCardCinematic({
        card: {
          name: "Actual card",
          rarity: "LR",
          category: "ANIME/MANGA",
          image: "/card.png"
        },
        controls: false,
        onContinue: () => continued++
      })
    );
    refs.at(-1).current = { contentWindow: child };
    const cleanup = effects[1]();
    assert.equal(tree.filter(node => node.type === "button").length, 0);
    assert.ok(tree[0].props.className.includes("yk-card-cinematic-clean"));
    const skip = tree.find(node => node.props?.role === "button");
    assert.equal(skip.props.tabIndex, 0);
    const message = {
      source: child,
      origin: "null",
      data: { type: "YOKKAI_CARD_COMPLETE" }
    };
    receive({ ...message, source: {} });
    receive({ ...message, origin: "https://evil.example" });
    assert.equal(continued, 0);
    if (action === "click") skip.props.onClick();
    if (action === "keyboard") {
      let prevented = false;
      skip.props.onKeyDown({
        key: "Enter",
        preventDefault() {
          prevented = true;
        }
      });
      assert.equal(prevented, true);
    }
    if (action === "complete") receive(message);
    assert.equal(continued, 1);
    receive(message);
    skip.props.onClick();
    assert.equal(continued, 1);
    cleanup();
  }
});

test("all final demo and pack integrations explicitly hide controls without changing legacy defaults", () => {
  for (const file of [
    "components/boosters.tsx",
    "components/card-cinematics-preview.tsx",
    "app/design-system/lr-cinematic/page.tsx"
  ]) {
    assert.match(read(file), /controls=\{false\}/);
  }
  assert.match(
    read("styles/lr-cinematic-preview.css"),
    /\.yk-lr-file-modal:has\(\.yk-card-cinematic-clean\) > div:first-child\s*\{\s*display: none;/
  );
});
