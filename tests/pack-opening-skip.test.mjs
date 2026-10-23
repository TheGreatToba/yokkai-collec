import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = file => readFileSync(file, "utf8");
const exports = {};
vm.runInNewContext(
  ts.transpileModule(read("lib/ui/booster-opening-document.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText,
  { exports, URL }
);

async function player({
  click = false,
  reduced = false,
  kind = "regular",
  delayed = false
} = {}) {
  const html = exports.boosterOpeningDocument(
    read("data/booster-opening/reveal.html"),
    "https://yokkai-collec.com",
    kind,
    click
  );
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(
    -1
  )[1];
  const timers = new Map(),
    listeners = new Map(),
    messages = [];
  let now = 0,
    id = 0,
    replays = 0,
    cancelled = 0,
    loaded;
  const animation = {
    currentTime: 0,
    playbackRate: 1,
    cancel() {
      cancelled++;
    }
  };
  const parent = { postMessage: data => messages.push(data.type) };
  vm.runInNewContext(script, {
    parent,
    performance: { now: () => now },
    setTimeout(fn, ms) {
      timers.set(++id, { fn, at: now + ms });
      return id;
    },
    clearTimeout: key => timers.delete(key),
    document: {
      styleSheets: [],
      getAnimations: () => [animation],
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
      documentElement: { classList: { add() {}, remove() {} } }
    },
    window: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
      matchMedia: () => ({ matches: reduced }),
      setYokkaiBooster: () =>
        delayed
          ? new Promise(resolve => {
              loaded = resolve;
            })
          : Promise.resolve(true),
      replayYokkaiBooster: () => replays++
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  const send = type =>
    listeners.get("message")?.({
      source: parent,
      origin: "https://yokkai-collec.com",
      data: { type }
    });
  return {
    animation,
    timers,
    messages,
    listeners,
    get replays() {
      return replays;
    },
    get cancelled() {
      return cancelled;
    },
    open: () => send("yokkai-booster-open"),
    async ready() {
      loaded(true);
      await new Promise(resolve => setImmediate(resolve));
    },
    skip: () => send("yokkai-booster-next-step"),
    advance(ms) {
      const end = now + ms;
      for (const [key, timer] of timers) {
        if (timer.at > end) continue;
        now = timer.at;
        timers.delete(key);
        timer.fn();
      }
      now = end;
    },
    dispose: () => listeners.get("pagehide")()
  };
}

for (const click of [false, true])
  for (const kind of ["regular", "decision"]) {
    test(`${kind}, click=${click}: start, skip intro, accelerate cut, ignore spam, complete once`, async () => {
      const p = await player({ click, kind });
      if (click) {
        p.skip();
        assert.equal(p.timers.size, 0);
        p.open();
        p.open();
        assert.equal(p.replays, 1);
        assert.equal(p.animation.currentTime, 0, "starting is not a skip");
      }
      p.skip();
      assert.equal(p.animation.currentTime, 2680);
      assert.equal(p.animation.playbackRate, 1);
      assert.equal(p.timers.size, 1);
      p.skip();
      assert.equal(p.animation.playbackRate, 3);
      const timer = [...p.timers.values()][0];
      for (let i = 0; i < 20; i++) p.skip();
      assert.equal([...p.timers.values()][0], timer);
      assert.equal(p.animation.currentTime, 2680);
      assert.equal(p.messages.includes("YOKKAI_BOOSTER_COMPLETE"), false);
      p.advance(839);
      assert.equal(p.messages.includes("YOKKAI_BOOSTER_COMPLETE"), false);
      p.advance(1);
      p.skip();
      p.advance(10000);
      assert.equal(
        p.messages.filter(x => x === "YOKKAI_BOOSTER_COMPLETE").length,
        1
      );
    });
  }

test("one skip plays the entire cut; a first skip during the cut only accelerates its remainder", async () => {
  const p = await player();
  p.skip();
  p.advance(2519);
  assert.equal(p.messages.includes("YOKKAI_BOOSTER_COMPLETE"), false);
  p.advance(1);
  assert.equal(p.messages.at(-1), "YOKKAI_BOOSTER_COMPLETE");
  const q = await player();
  q.advance(3000);
  q.animation.currentTime = 3000;
  q.skip();
  assert.equal(q.animation.currentTime, 3000);
  assert.equal(q.animation.playbackRate, 3);
  q.advance(733);
  assert.equal(q.messages.includes("YOKKAI_BOOSTER_COMPLETE"), false);
  q.advance(1);
  assert.equal(q.messages.at(-1), "YOKKAI_BOOSTER_COMPLETE");
});

test("unmount cancels the active timer, animations and listeners at every stage", async () => {
  for (const skips of [0, 1, 2]) {
    const p = await player();
    for (let i = 0; i < skips; i++) p.skip();
    const stale = [...p.timers.values()][0].fn;
    p.dispose();
    stale();
    p.advance(10000);
    p.skip();
    assert.equal(p.timers.size, 0);
    assert.equal(p.cancelled, 1);
    assert.equal(p.listeners.has("message"), false);
    assert.equal(p.listeners.has("animationstart"), false);
    assert.equal(p.messages.includes("YOKKAI_BOOSTER_COMPLETE"), false);
  }
});

test("reduced motion retains the 500ms opening and ignores skip spam", async () => {
  for (const click of [false, true]) {
    const p = await player({ click, reduced: true });
    if (click) p.open();
    p.skip();
    p.skip();
    p.skip();
    assert.equal(p.animation.playbackRate, 1);
    p.advance(499);
    assert.equal(p.messages.includes("YOKKAI_BOOSTER_COMPLETE"), false);
    p.advance(1);
    assert.equal(p.messages.at(-1), "YOKKAI_BOOSTER_COMPLETE");
  }
});

test("early skip spam is bounded and replayed once on readiness; late loading cannot revive a disposed player", async () => {
  for (const click of [false, true]) {
    const p = await player({ click, delayed: true });
    if (click) p.open();
    for (let i = 0; i < 20; i++) p.skip();
    assert.equal(p.timers.size, 0);
    await p.ready();
    assert.equal(p.animation.currentTime, 2680);
    assert.equal(p.animation.playbackRate, 3);
    assert.equal(p.timers.size, 1);
    p.advance(840);
    assert.equal(
      p.messages.filter(x => x === "YOKKAI_BOOSTER_COMPLETE").length,
      1
    );
  }
  const p = await player({ delayed: true });
  p.dispose();
  await p.ready();
  assert.equal(p.messages.length, 0);
  assert.equal(p.timers.size, 0);
});

test("the parent preserves two early skips without counting the initial gesture", () => {
  const source = read("components/boosters.tsx");
  const body = source.match(
    /const speedUpSeal = \(\) => \{([\s\S]*?)\n  \};/
  )[1];
  const messages = [];
  const frame = {
    dataset: { ready: "false" },
    contentWindow: { postMessage: data => messages.push(data.type) }
  };
  const stage = { current: { querySelector: () => frame } };
  const clicked = { current: false },
    pending = { current: 0 };
  const advance = new Function(
    "openingStage",
    "clickToOpen",
    "openingClicked",
    "setTearRequested",
    "pendingOpeningSkips",
    body
  );
  const skip = () => advance(stage, true, clicked, () => {}, pending);
  skip();
  assert.equal(pending.current, 0);
  for (let i = 0; i < 20; i++) skip();
  assert.equal(pending.current, 2);
  assert.deepEqual(messages, ["yokkai-booster-open"]);
});

test("only multi-click mousedown prevents selection; all generated pack images are non-draggable", () => {
  const source = read("components/boosters.tsx");
  const body = source.match(/onMouseDown=\{event => \{([\s\S]*?)\}\}/)[1];
  const down = new Function("event", body);
  for (const detail of [1, 2, 3, 20]) {
    let prevented = false;
    down({
      detail,
      preventDefault() {
        prevented = true;
      }
    });
    assert.equal(prevented, detail > 1);
  }
  const html = exports.boosterOpeningDocument(
    read("data/booster-opening/reveal.html"),
    "https://yokkai-collec.com",
    "regular"
  );
  assert(
    [...html.matchAll(/<img\b[^>]*>/g)].every(([tag]) =>
      tag.includes('draggable="false"')
    )
  );
  assert.match(read("components/booster-opening.tsx"), /draggable=\{false\}/);
});
