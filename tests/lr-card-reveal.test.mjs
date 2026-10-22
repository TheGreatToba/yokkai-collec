import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
test("LR uses one native effect and the reference final sequence, without the retired player", () => {
  const component = read("components/lr-card-reveal.tsx");
  const css = read("styles/lr-card-reveal.css");
  assert.match(read("components/card-cinematic.tsx"), /rarity === "LR"/);
  assert.match(component, /15370/);
  assert.match(component, /clearTimeout/);
  assert.match(component, /animated={false}/);
  assert.doesNotMatch(
    component,
    /iframe|requestAnimationFrame|setInterval|createElement|new Audio/
  );
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /6\.3s/);
  assert.match(css, /9\.03s/);
  assert.match(css, /lr-gold-world\.webp/);
  assert.doesNotMatch(css, /will-change|data:image/);
});

// Exercise StrictMode's setup/cleanup/setup, both completion paths and unmount.
test("LR completes once at 15.37s (700ms with reduced motion), cleans its timer and leaves CSS owned by the DOM", async () => {
  const { createRequire } = await import("node:module");
  const { default: vm } = await import("node:vm");
  const { default: ts } = await import("typescript");
  const { default: React } = await import("react");
  const require = createRequire(import.meta.url);
  for (const reduced of [false, true]) {
    const effects = [],
      refs = [],
      timers = new Map(),
      cleared = [];
    let nextId = 0,
      continued = 0,
      paused = 0,
      cancelled = 0;
    const exports = {};
    vm.runInNewContext(
      ts.transpileModule(read("components/lr-card-reveal.tsx"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX
        }
      }).outputText,
      {
        exports,
        require: name =>
          name === "react"
            ? {
                ...React,
                useRef: initial => {
                  const ref = { current: initial };
                  refs.push(ref);
                  return ref;
                },
                useEffect: fn => effects.push(fn)
              }
            : name === "@/components/yokai-card"
              ? { YokaiCard: "Card" }
              : name.endsWith(".css")
                ? {}
                : require(name),
        window: {
          matchMedia: () => ({ matches: reduced }),
          setTimeout: (fn, delay) => {
            timers.set(++nextId, { fn, delay });
            return nextId;
          },
          clearTimeout: id => {
            cleared.push(id);
            timers.delete(id);
          }
        }
      }
    );
    const tree = exports.LrCardReveal({
      card: {
        name: "Actual",
        image: "/card.png",
        category: "ANIME/MANGA",
        rarity: "LR"
      },
      onContinue: () => continued++
    });
    refs[2].current = {
      isConnected: true,
      getAnimations: () => [
        { pause: () => paused++, cancel: () => cancelled++ }
      ]
    };
    effects[0]();
    effects[1]()(); // StrictMode cleanup must remove the first timer.
    assert.equal(timers.size, 0);
    assert.equal(
      cancelled,
      0,
      "StrictMode must not cancel the visible sequence"
    );
    const cleanup = effects[1]();
    assert.equal(timers.size, 1);
    const timer = [...timers.values()][0];
    assert.equal(timer.delay, reduced ? 700 : 15370);
    timer.fn();
    const button = React.Children.toArray(tree.props.children).find(
      child => child.type === "button"
    );
    button.props.onClick();
    timer.fn();
    assert.equal(continued, 1);
    assert.equal(paused, 0);
    refs[2].current.isConnected = false;
    cleanup();
    assert.equal(timers.size, 0);
    assert.equal(cancelled, 2);
    assert.equal(cleared.length, 2);
  }
});

test("all native LR keyframes change only transform and opacity, with no global selectors", async () => {
  const { default: postcss } = await import("postcss");
  const ast = postcss.parse(read("styles/lr-card-reveal.css"));
  ast.walkAtRules("keyframes", rule =>
    rule.walkDecls(decl =>
      assert.ok(
        ["transform", "opacity", "animation-timing-function"].includes(
          decl.prop
        ),
        decl.toString()
      )
    )
  );
  ast.walkRules(rule => {
    if (rule.parent.type !== "atrule" || rule.parent.name !== "keyframes")
      assert.doesNotMatch(rule.selector, /(^|,)\s*(html|body|:root|\*)/);
  });
});
