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
