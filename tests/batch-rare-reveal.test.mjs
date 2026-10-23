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
      ...globals,
      require: name => (name in mocks ? mocks[name] : require(name))
    }
  );
  return exports;
}
const pack = load("lib/ui/pack-opening.ts", { "@/lib/ui/animations": {} });
function descendants(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(descendants)
  ];
}
function hooks() {
  const states = [],
    refs = [],
    effects = [],
    pending = [];
  let effectIndex = 0;
  let index = 0,
    refIndex = 0;
  return {
    reset() {
      index = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    flush() {
      pending.splice(0).forEach(fn => fn());
    },
    unmount() {
      effects.forEach(effect => effect?.cleanup?.());
    },
    refs,
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
      useRef(initial) {
        return (refs[refIndex++] ??= { current: initial });
      },
      useEffect(fn, deps) {
        const position = effectIndex++;
        const previous = effects[position];
        if (
          !previous ||
          !deps ||
          deps.some((dep, i) => !Object.is(dep, previous.deps[i]))
        ) {
          pending.push(() => {
            previous?.cleanup?.();
            effects[position] = { deps, cleanup: fn() };
          });
        }
      },
      useCallback: fn => fn
    }
  };
}
function revealHarness(
  count = 10,
  environment = "development",
  reduced = false
) {
  const state = hooks();
  const { BoosterReveal } = load(
    "components/boosters.tsx",
    {
      react: state.react,
      "next/dynamic": { default: () => "Dynamic" },
      "next/link": { default: "Link" },
      "@/lib/ui/pack-opening": pack,
      "@/lib/ui/animations": {},
      "@/components/referral-reminder": { ReferralReminder: "Reminder" },
      "@/components/ambient-glow": { AmbientGlow: "AmbientGlow" },
      "@/components/card-sharing": { CardShareButton: "CardShareButton" },
      "@/components/ui": {
        Button: "Button",
        Modal: "Modal",
        SelectionBar: "SelectionBar",
        SelectionModeButton: "SelectionModeButton",
        StatusPill: "StatusPill"
      },
      "@/components/yokai-card": {
        CardBack: "CardBack",
        YokaiCard: "YokaiCard"
      }
    },
    {
      process: { env: { NODE_ENV: environment } },
      clearTimeout() {},
      window: {
        matchMedia: () => ({ matches: reduced }),
        setTimeout: () => 1,
        clearTimeout() {}
      }
    }
  );
  const props = {
    previewOnly: true,
    finalCinematics: true,
    releasedCinematics: true,
    packCount: count,
    cards: Array.from({ length: count * 5 }, (_, i) => ({
      id: `card-${i}`,
      instanceId: `copy-${i}`,
      name: `Card ${i}`,
      image: "/card.png",
      rarity: i % 5 === 4 ? "LR" : i % 5 === 3 ? "SSR" : "C",
      isNew: true
    })),
    revealed: 0,
    onReveal() {},
    onReturn() {},
    onComplete() {}
  };
  const render = () => {
    state.reset();
    const tree = descendants(BoosterReveal(props));
    state.flush();
    return tree;
  };
  const slots = tree =>
    React.Children.toArray(
      tree.find(
        node =>
          node.type === "ol" &&
          node.props.className.startsWith("yk-reveal-grid")
      ).props.children
    );
  return { props, render, slots, unmount: () => state.unmount() };
}

for (const count of [5, 10]) {
  test(`x${count} reveals common cards immediately and queues SSR/LR including Shiny in draw order`, () => {
    const { props, render, slots } = revealHarness(count);
    props.cards.forEach((card, i) => {
      card.shiny = i % 2 === 0;
      if (i % 5 < 3) card.rarity = ["C", "R", "SR"][i % 5];
    });
    props.revealed = 4; // Includes an SSR already revealed manually.
    const committed = [];
    props.onReveal = i => {
      committed.push(i);
      props.revealed++;
    };
    const queue = [...pack.packRareRevealQueue(props.cards, props.revealed)];
    const button = render().find(node => node.props?.children === "Reveal all");
    button.props.onClick();
    button.props.onClick();
    let tree = render();
    assert.equal(
      slots(tree).filter(node => node.props.className.includes("yk-filled"))
        .length,
      props.cards.length - queue.length
    );
    assert.equal(
      tree.find(node => node.props?.children === "Reveal all").props.disabled,
      true
    );
    for (const index of queue) {
      tree = render();
      const players = tree.filter(node => node.type === "Dynamic");
      assert.equal(players.length, 1);
      const player = players[0];
      assert.equal(player.props.card.instanceId, props.cards[index].instanceId);
      assert.equal(player.props.autoAdvance, true);
      assert.ok(
        tree
          .filter(
            node =>
              node.type === "button" &&
              node.props.className?.includes("yk-reveal-card")
          )
          .every(node => node.props.disabled)
      );
      player.props.onContinue();
      player.props.onContinue(); // A late callback cannot consume the next card.
    }
    tree = render();
    assert.equal(tree.filter(node => node.type === "Dynamic").length, 0);
    assert.equal(
      slots(tree).filter(node => node.props.className.includes("yk-filled"))
        .length,
      props.cards.length
    );
    assert.deepEqual(
      committed,
      Array.from({ length: props.cards.length - 4 }, (_, i) => i + 4)
    );
  });
}

test("zero rares and reduced motion complete without mounting a player", () => {
  for (const reduced of [false, true]) {
    const { props, render, slots } = revealHarness(5, "development", reduced);
    if (!reduced)
      props.cards.forEach(card => {
        card.rarity = "SR";
      });
    props.onReveal = () => props.revealed++;
    render()
      .find(node => node.props?.children === "Reveal all")
      .props.onClick();
    const tree = render();
    assert.equal(props.revealed, 25);
    assert.equal(slots(tree).length, 25);
    assert.equal(tree.filter(node => node.type === "Dynamic").length, 0);
  }
});

test("one rare completes once; Skip all and modal close reveal every remaining card", () => {
  for (const action of ["one", "skip-all", "close"]) {
    const { props, render } = revealHarness(5);
    if (action === "one")
      props.cards.forEach((card, i) => {
        card.rarity = i === 17 ? "LR" : "C";
      });
    props.onReveal = () => props.revealed++;
    render()
      .find(node => node.props?.children === "Reveal all")
      .props.onClick();
    const tree = render();
    const player = tree.find(node => node.type === "Dynamic");
    if (action === "one") player.props.onContinue();
    else if (action === "skip-all") player.props.onSkipAll();
    else
      tree
        .find(node => node.type === "Modal" && node.props.open)
        .props.onClose();
    player.props.onContinue();
    assert.equal(props.revealed, 25);
    assert.equal(render().filter(node => node.type === "Dynamic").length, 0);
  }
});

test("unmount clears the queue so a late cinematic completion cannot advance it", () => {
  const { props, render, unmount } = revealHarness(10);
  let commits = 0;
  props.onReveal = () => commits++;
  render()
    .find(node => node.props?.children === "Reveal all")
    .props.onClick();
  const player = render().find(node => node.type === "Dynamic");
  unmount();
  player.props.onContinue();
  assert.equal(commits, 0);
});

function playerHarness(reduced = false) {
  const state = hooks();
  const timers = new Set();
  const listeners = new Set();
  let completeFinite;
  const finite = {
    finished: new Promise(resolve => {
      completeFinite = resolve;
    }),
    effect: { getComputedTiming: () => ({ iterations: 1 }) },
    pause() {},
    cancel() {
      this.cancelled = true;
    }
  };
  const infinite = {
    finished: new Promise(() => {}),
    effect: { getComputedTiming: () => ({ iterations: Infinity }) },
    pause() {},
    cancel() {
      this.cancelled = true;
    }
  };
  const element = {
    isConnected: true,
    getAnimations: () => [finite, infinite],
    querySelector: () => null
  };
  const media = {
    matches: reduced,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn)
  };
  const { LrCardReveal } = load(
    "components/lr-card-reveal.tsx",
    {
      react: state.react,
      "@/components/yokai-card": { YokaiCard: "YokaiCard" },
      "@/styles/lr-card-reveal.css": {}
    },
    {
      window: {
        matchMedia: () => media,
        setTimeout: fn => {
          timers.add(fn);
          return fn;
        },
        clearTimeout: fn => timers.delete(fn)
      }
    }
  );
  let continued = 0,
    skippedAll = 0;
  state.reset();
  const tree = descendants(
    LrCardReveal({
      card: { name: "Rare", rarity: "LR", image: "/card.png", shiny: true },
      autoAdvance: true,
      onContinue: () => continued++,
      onSkipAll: () => skippedAll++
    })
  );
  tree[0].props.ref.current = element;
  state.flush();
  return {
    tree,
    completeFinite,
    timers,
    listeners,
    media,
    finite,
    infinite,
    continued: () => continued,
    skippedAll: () => skippedAll,
    unmount() {
      element.isConnected = false;
      state.unmount();
    }
  };
}

test("player waits for real finite animation completion, ignoring infinite decoration", async () => {
  const player = playerHarness();
  assert.equal(player.continued(), 0);
  player.completeFinite();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(player.continued(), 1);
  player.unmount();
  assert.equal(player.timers.size, 0);
  assert.equal(player.listeners.size, 0);
  assert.equal(player.finite.cancelled, true);
  assert.equal(player.infinite.cancelled, true);
});

test("Skip advances exactly once and Skip all has a separate action", () => {
  const player = playerHarness();
  const skip = player.tree.find(node => node.props?.children === "Skip");
  skip.props.onClick();
  skip.props.onClick();
  assert.equal(player.continued(), 1);
  player.tree.find(node => node.props?.children === "Skip all").props.onClick();
  assert.equal(player.skippedAll(), 1);
  player.unmount();
});

test("unmount cancels pending animation completion and cleans timers/listeners", async () => {
  const player = playerHarness();
  player.unmount();
  player.completeFinite();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(player.continued(), 0);
  assert.equal(player.timers.size, 0);
  assert.equal(player.listeners.size, 0);
});

test("reduced motion finishes immediately and switching the preference finishes the current reveal", () => {
  for (const reduced of [true, false]) {
    const player = playerHarness(reduced);
    if (!reduced) {
      player.media.matches = true;
      player.listeners.forEach(fn => fn());
    }
    assert.equal(player.continued(), 1);
    player.unmount();
  }
});

test("a manually viewed rare awaiting placement is not replayed by Reveal all", () => {
  const { props, render } = revealHarness(5);
  props.cards.forEach((card, i) => {
    card.rarity = i === 0 ? "SSR" : i === 12 ? "LR" : "C";
  });
  render()
    .find(node => node.props?.["aria-label"] === "Reveal card 1 of 25")
    .props.onClick();
  render()
    .find(node => node.type === "Dynamic")
    .props.onContinue();
  render()
    .find(node => node.props?.children === "Reveal all")
    .props.onClick();
  const players = render().filter(node => node.type === "Dynamic");
  assert.equal(players.length, 1);
  assert.equal(players[0].props.card.instanceId, props.cards[12].instanceId);
});
