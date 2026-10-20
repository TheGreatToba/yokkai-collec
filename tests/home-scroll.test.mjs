import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

test("wheel loops in both directions without moving the page", () => {
  const loaded = { exports: {} };
  let resize, recenter;
  const clones = [{ hidden: false }, { hidden: false }];
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/ui/horizontal-wheel.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
    }).outputText,
    {
      exports: loaded.exports,
      document: { activeElement: null },
      ResizeObserver: class {
        constructor(callback) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    }
  );
  let listener;
  const period = { offsetWidth: 1000 };
  const element = {
    scrollLeft: 0,
    scrollWidth: 3000,
    querySelector: () => period,
    querySelectorAll: () => clones,
    contains: () => false,
    clientWidth: 200,
    addEventListener(name, fn, options) {
      if (name === "scroll") {
        recenter = fn;
        return;
      }
      assert.equal(options.passive, false);
      listener = fn;
    },
    removeEventListener(name, fn) {
      if (name !== "wheel") return;
      assert.equal(fn, listener);
      listener = null;
    }
  };
  const cleanup = loaded.exports.enableHorizontalWheel(element);
  assert.equal(element.scrollLeft, 1000);
  element.scrollLeft = 995;
  recenter();
  assert.equal(element.scrollLeft, 1995);
  element.scrollLeft = 2005;
  recenter();
  assert.equal(element.scrollLeft, 1005);
  element.scrollLeft = 1000;
  const wheel = (deltaY, overrides = {}) => {
    let prevented = false;
    listener({
      deltaY,
      deltaX: 0,
      deltaMode: 0,
      ctrlKey: false,
      preventDefault() {
        prevented = true;
      },
      ...overrides
    });
    return prevented;
  };
  assert.equal(wheel(-10), true);
  assert.equal(element.scrollLeft, 1990);
  assert.equal(wheel(10), true);
  assert.equal(element.scrollLeft, 1000);
  assert.equal(wheel(120), true);
  assert.equal(element.scrollLeft, 1120);
  assert.equal(wheel(2, { deltaMode: 1 }), true);
  assert.equal(element.scrollLeft, 1152);
  assert.equal(wheel(100, { ctrlKey: true }), false);
  assert.equal(wheel(2, { deltaX: 30 }), true);
  assert.equal(element.scrollLeft, 1182);
  assert.equal(wheel(10000), true);
  assert.equal(element.scrollLeft, 1182);
  assert.equal(wheel(900), true);
  assert.equal(element.scrollLeft, 1082);
  assert.equal(wheel(-200), true);
  assert.equal(element.scrollLeft, 1882);
  period.offsetWidth = 100;
  resize();
  assert.ok(clones.every(copy => copy.hidden));
  period.offsetWidth = 1000;
  resize();
  assert.ok(clones.every(copy => !copy.hidden));
  period.offsetWidth = 0;
  element.scrollWidth = element.clientWidth;
  assert.equal(wheel(120), false);
  assert.equal(wheel(0), false);
  cleanup();
  assert.equal(listener, null);
});

test("automatic scrolling yields to interaction, reduced motion and hidden tabs", () => {
  const loaded = { exports: {} };
  let tick,
    cleared = false,
    now = 0;
  const motion = { matches: false },
    document = { hidden: false };
  const listeners = new Map();
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/ui/horizontal-wheel.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
    }).outputText,
    {
      exports: loaded.exports,
      document,
      Date: { now: () => now },
      window: {
        matchMedia: () => motion,
        setInterval: fn => {
          tick = fn;
          return 1;
        },
        clearInterval: () => {
          cleared = true;
        }
      }
    }
  );
  let hovered = false;
  const period = { offsetWidth: 1000 };
  const element = {
    scrollLeft: 1000,
    scrollWidth: 3000,
    querySelector: () => period,
    clientWidth: 200,
    matches: () => hovered,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name)
  };
  const cleanup = loaded.exports.enableAutomaticScroll(element);
  tick();
  assert.equal(element.scrollLeft, 1002);
  hovered = true;
  tick();
  assert.equal(element.scrollLeft, 1002);
  hovered = false;
  listeners.get("wheel")();
  element.scrollLeft = 1100;
  now = 5000;
  tick();
  assert.equal(element.scrollLeft, 1100);
  now = 6001;
  tick();
  assert.equal(element.scrollLeft, 1102);
  motion.matches = true;
  tick();
  assert.equal(element.scrollLeft, 1102);
  motion.matches = false;
  document.hidden = true;
  tick();
  assert.equal(element.scrollLeft, 1102);
  document.hidden = false;
  element.scrollLeft = 1999;
  tick();
  assert.equal(element.scrollLeft, 1001);
  cleanup();
  assert.equal(cleared, true);
  assert.equal(listeners.size, 0);
});
