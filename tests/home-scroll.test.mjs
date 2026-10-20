import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

test("wheel scrolls the strip and releases the page at either end", () => {
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/ui/horizontal-wheel.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
    }).outputText,
    { exports: loaded.exports }
  );
  let listener;
  const element = {
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 200,
    addEventListener(name, fn, options) {
      assert.equal(name, "wheel");
      assert.equal(options.passive, false);
      listener = fn;
    },
    removeEventListener(name, fn) {
      assert.equal(name, "wheel");
      assert.equal(fn, listener);
      listener = null;
    }
  };
  const cleanup = loaded.exports.enableHorizontalWheel(element);
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
  assert.equal(wheel(-10), false);
  assert.equal(wheel(120), true);
  assert.equal(element.scrollLeft, 120);
  assert.equal(wheel(2, { deltaMode: 1 }), true);
  assert.equal(element.scrollLeft, 152);
  assert.equal(wheel(100, { ctrlKey: true }), false);
  assert.equal(wheel(2, { deltaX: 30 }), false);
  assert.equal(wheel(10000), true);
  assert.equal(element.scrollLeft, 800);
  assert.equal(wheel(120), false);
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
  const element = {
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 200,
    matches: () => hovered,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name)
  };
  const cleanup = loaded.exports.enableAutomaticScroll(element);
  tick();
  assert.equal(element.scrollLeft, 2);
  hovered = true;
  tick();
  assert.equal(element.scrollLeft, 2);
  hovered = false;
  listeners.get("wheel")();
  element.scrollLeft = 100;
  now = 5000;
  tick();
  assert.equal(element.scrollLeft, 100);
  now = 6001;
  tick();
  assert.equal(element.scrollLeft, 102);
  motion.matches = true;
  tick();
  assert.equal(element.scrollLeft, 102);
  motion.matches = false;
  document.hidden = true;
  tick();
  assert.equal(element.scrollLeft, 102);
  document.hidden = false;
  element.scrollLeft = 800;
  tick();
  assert.equal(element.scrollLeft, 0);
  cleanup();
  assert.equal(cleared, true);
  assert.equal(listeners.size, 0);
});
