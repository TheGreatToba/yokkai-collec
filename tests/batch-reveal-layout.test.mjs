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
    refs = [];
  let index = 0,
    refIndex = 0;
  return {
    reset() {
      index = 0;
      refIndex = 0;
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
      useRef(initial) {
        return (refs[refIndex++] ??= { current: initial });
      },
      useEffect() {},
      useCallback: fn => fn
    }
  };
}
function revealHarness(count = 10) {
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
    { process: { env: { NODE_ENV: "development" } } }
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
    return descendants(BoosterReveal(props));
  };
  const slots = tree =>
    React.Children.toArray(
      tree.find(
        node =>
          node.type === "ol" &&
          node.props.className.startsWith("yk-reveal-grid")
      ).props.children
    );
  return { props, render, slots };
}

test("five-card windows cover every reward, clamp page requests and never expose an unrevealed future group", () => {
  for (const total of [25, 50]) {
    const covered = new Set();
    for (let revealed = 0; revealed <= total; revealed++) {
      const window = pack.packRevealWindow(total, revealed);
      assert.equal(window.end - window.start, 5);
      assert.equal(window.pages, total / 5);
      assert.equal(
        window.page,
        Math.min(total / 5 - 1, Math.floor(revealed / 5))
      );
      assert.equal(
        pack.packRevealWindow(total, revealed, 100).page,
        window.latest
      );
      assert.equal(pack.packRevealWindow(total, revealed, -1).page, 0);
      assert.equal(
        pack.packRevealWindow(total, revealed, NaN).page,
        window.page
      );
      for (let index = window.start; index < window.end; index++)
        covered.add(index);
    }
    assert.equal(covered.size, total);
  }
});

test("batch reveals mount only five result slots and a compact accessible progress meter", () => {
  for (const count of [5, 10]) {
    const { props, render, slots } = revealHarness(count);
    for (const revealed of [0, 4, 5, 6, count * 5 - 1, count * 5]) {
      props.revealed = revealed;
      const tree = render();
      const group = slots(tree);
      assert.equal(group.length, 5);
      assert.deepEqual(
        group.map(node => node.props.style["--slot-i"]),
        [0, 1, 2, 3, 4]
      );
      const window = pack.packRevealWindow(props.cards.length, revealed);
      group.forEach((node, index) =>
        assert.equal(
          node.props.className.includes("yk-filled"),
          window.start + index < revealed
        )
      );
      const progress = tree.find(node => node.props?.role === "progressbar");
      assert.equal(progress.props["aria-valuenow"], revealed);
      assert.equal(progress.props["aria-valuemax"], count * 5);
      assert.equal(progress.props["aria-label"], "Cards revealed");
      assert.equal(
        tree.some(
          node =>
            node.type === "ol" &&
            node.props.className.startsWith("yk-reveal-progress")
        ),
        false
      );
      assert.equal(
        tree.find(node => node.props?.["aria-label"] === "Next five cards")
          .props.disabled,
        true
      );
    }
  }
});

test("previous groups remain reviewable and the next reveal follows the live group without altering reward indices", () => {
  const { props, render, slots } = revealHarness();
  props.revealed = 5;
  render()
    .find(node => node.props?.["aria-label"] === "Previous five cards")
    .props.onClick();
  let tree = render();
  assert.ok(
    tree.some(
      node =>
        React.Children.toArray(node.props?.children).join("") === "Cards 1–5"
    )
  );
  assert.ok(
    slots(tree).every(node => node.props.className.includes("yk-filled"))
  );
  assert.equal(
    tree.find(node => node.props?.["aria-label"] === "Next five cards").props
      .disabled,
    false
  );
  props.revealed = 6;
  tree = render();
  assert.ok(
    tree.some(
      node =>
        React.Children.toArray(node.props?.children).join("") === "Cards 6–10"
    )
  );
  assert.equal(
    slots(tree).filter(node => node.props.className.includes("yk-filled"))
      .length,
    1
  );
  const currentSlot = slots(tree).find(node =>
    node.props.className.includes("yk-slot-next")
  );
  assert.ok(currentSlot);
  assert.ok(
    descendants(currentSlot).some(node => node.props?.children === "07")
  );
});

test("completed batches can browse every group and only offer replays for the five visible cards", () => {
  const { props, render, slots } = revealHarness();
  props.revealed = 50;
  for (let page = 9; page >= 0; page--) {
    const tree = render();
    assert.equal(slots(tree).length, 5);
    const cardNodes = tree.filter(node => node.type === "YokaiCard");
    assert.equal(cardNodes.length, 5);
    assert.deepEqual(
      cardNodes.map(node => node.props.instanceId),
      Array.from({ length: 5 }, (_, i) => `copy-${page * 5 + i}`)
    );
    const replayButtons = tree.filter(
      node =>
        node.type === "Button" &&
        React.Children.toArray(node.props.children)
          .join("")
          .startsWith("Replay cinematic:")
    );
    assert.equal(replayButtons.length, 2);
    assert.equal(
      tree.find(node => node.props?.["aria-label"] === "Previous five cards")
        .props.disabled,
      page === 0
    );
    if (page > 0)
      tree
        .find(node => node.props?.["aria-label"] === "Previous five cards")
        .props.onClick();
  }
});

test("single packs and Decision choices keep their original five-card layout", () => {
  const { props, render, slots } = revealHarness(1);
  for (const decision of [undefined, { onKeep: async () => 0 }]) {
    props.decision = decision;
    const tree = render();
    assert.equal(slots(tree).length, 5);
    assert.equal(
      tree.some(node => node.props?.["aria-label"] === "Batch card groups"),
      false
    );
    assert.equal(
      tree.some(node => node.props?.role === "progressbar"),
      false
    );
    assert.ok(
      tree.find(
        node =>
          node.type === "ol" &&
          node.props.className.startsWith("yk-reveal-progress")
      )
    );
  }
});

test("discarded copies do not shift global reveal indices inside a group", () => {
  const { props, render, slots } = revealHarness();
  props.cards[5].discarded = true;
  props.revealed = 6;
  const group = slots(render());
  assert.equal(group.length, 4);
  assert.equal(
    group.filter(node => node.props.className.includes("yk-filled")).length,
    0
  );
  const current = group.find(node =>
    node.props.className.includes("yk-slot-next")
  );
  assert.ok(current);
  assert.ok(descendants(current).some(node => node.props?.children === "07"));
  assert.deepEqual(
    group.map(node => node.props.style["--slot-i"]),
    [1, 2, 3, 4]
  );
});

test("batch styles cap the visible stack, override its unbounded inline fan, and adapt the results to desktop/mobile", () => {
  const css = read("styles/boosters.css").replace(/\s+/g, " ");
  assert.match(css, /\.yk-reveal-batch \.yk-stacked-back \{ display: none; \}/);
  assert.match(
    css,
    /\.yk-reveal-batch \.yk-stacked-back:nth-child\(-n \+ 3\) \{ display: block; transform: translate\(6px, -6px\) rotate\(1deg\) !important; filter: brightness\(0\.9\) !important;/
  );
  assert.match(
    css,
    /\.yk-reveal-batch \.yk-stacked-back:first-child \{ transform: translate\(18px, -18px\) rotate\(3deg\) !important;/
  );
  assert.match(css, /\.yk-reveal-screen\.yk-reveal-batch \{ display: grid;/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(
    css,
    /\.yk-reveal-batch\.yk-reveal-complete > \.yk-reveal-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.doesNotMatch(css, /\.yk-reveal-batch[^}]*overflow:\s*hidden/);
});

test("batch fullscreen keeps its controls scrollable on short/mobile screens while retaining the pack background", () => {
  const css = read("styles/boosters.css").replace(/\s+/g, " ");
  assert.match(
    css,
    /\.yk-reveal-screen\.yk-reveal-batch\[data-reveal-state="revealing"\] \{ overflow-y: auto;/
  );
  assert.match(
    css,
    /grid-template-rows: auto auto auto auto; align-content: start;/
  );
  assert.match(css, /\.yk-batch-pagination button \{ min-height: 44px;/);
  const section = revealHarness()
    .render()
    .find(node => node.type === "section");
  assert.equal(section.props["data-pack-kind"], "regular");
  assert.equal(section.props["data-reveal-state"], "revealing");
  assert.ok(section.props.className.includes("yk-reveal-batch"));
});
