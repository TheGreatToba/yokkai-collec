import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
test("LR uses one native effect and the reference final sequence, without the retired player", () => {
  const component = read("components/lr-card-reveal.tsx");
  const css = read("styles/lr-card-reveal.css");
  assert.match(read("components/card-cinematic.tsx"), /rarity === "LR"/);
  assert.match(component, /12400/);
  assert.match(component, /clearTimeout/);
  assert.match(component, /animated={false}/);
  assert.doesNotMatch(
    component,
    /iframe|requestAnimationFrame|setInterval|new Audio/
  );
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /6\.3s/);
  assert.match(css, /9\.03s/);
  assert.match(css, /lr-gold-world\.webp/);
  assert.doesNotMatch(css, /will-change|data:image/);
});

// Exercise StrictMode's setup/cleanup/setup, both completion paths and unmount.
test("LR exposes final controls at 12.4s (700ms with reduced motion), continues once and cleans its sequence", async () => {
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
                useEffect: fn => effects.push(fn),
                useState: initial => [initial, () => {}]
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
    const traits = React.Children.toArray(tree.props.children).find(
      child => child.props.className === "yk-lr-traits"
    );
    assert.equal(React.Children.count(traits.props.children), 4);
    for (const phase of React.Children.toArray(traits.props.children)) {
      const nodes = React.Children.toArray(phase.props.children);
      assert.equal(
        nodes.filter(node => node.props.className === "yk-lr-stroke").length,
        24
      );
      assert.equal(
        nodes.filter(node => node.props.className === "yk-lr-dot").length,
        18
      );
    }
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
    assert.equal(timer.delay, reduced ? 700 : 12400);
    timer.fn();
    assert.equal(
      continued,
      0,
      "the reference waits for Next rather than cutting off its ending"
    );
    const button = React.Children.toArray(tree.props.children).find(
      child => child.type === "button"
    );
    button.props.onClick();
    timer.fn();
    assert.equal(continued, 1);
    assert.equal(paused, 1);
    refs[2].current.isConnected = false;
    cleanup();
    assert.equal(timers.size, 0);
    assert.equal(cancelled, 1);
    assert.equal(cleared.length, 2);
  }
});

test("artwork colors are sampled once and the canvas, handlers and timeout are released on success, CORS denial or unmount", async () => {
  const { createRequire } = await import("node:module");
  const { default: vm } = await import("node:vm");
  const { default: ts } = await import("typescript");
  const { default: React } = await import("react");
  const require = createRequire(import.meta.url);
  for (const outcome of ["ready", "cors", "unmount"]) {
    const effects = [],
      refs = [],
      listeners = new Map(),
      properties = new Map(),
      timers = new Map();
    let samples = 0,
      removed = 0;
    const image = {
      complete: false,
      naturalWidth: 96,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => {
        listeners.delete(name);
        removed++;
      }
    };
    const pixels = new Uint8ClampedArray(96 * 96 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = i < pixels.length * 0.7 ? 220 : 30;
      pixels[i + 1] = 40;
      pixels[i + 2] = i < pixels.length * 0.7 ? 30 : 220;
      pixels[i + 3] = 255;
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {
          assert.equal(canvas.width, 96);
          assert.equal(canvas.height, 96);
          samples++;
        },
        getImageData: () => {
          if (outcome === "cors") throw Error("tainted image");
          return { data: pixels };
        }
      })
    };
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
                useEffect: fn => effects.push(fn),
                useState: initial => [initial, () => {}]
              }
            : name === "@/components/yokai-card"
              ? { YokaiCard: "Card" }
              : name.endsWith(".css")
                ? {}
                : require(name),
        document: {
          createElement: name => {
            assert.equal(name, "canvas");
            return canvas;
          }
        },
        window: {
          setTimeout: (fn, delay) => {
            assert.equal(delay, 5000);
            timers.set(1, fn);
            return 1;
          },
          clearTimeout: id => timers.delete(id)
        }
      }
    );
    exports.LrCardReveal({
      card: {
        name: "Actual",
        image: "/art.png",
        category: "ANIME/MANGA",
        rarity: "LR"
      }
    });
    refs[2].current = {
      querySelector: selector => {
        assert.equal(selector, "img");
        return image;
      },
      style: { setProperty: (key, value) => properties.set(key, value) }
    };
    const cleanup = effects[2]();
    assert.equal(listeners.size, 2);
    if (outcome !== "unmount") listeners.get("load")();
    cleanup();
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
    assert.equal(listeners.size, 0);
    assert.equal(timers.size, 0);
    assert.ok(removed >= 1);
    assert.equal(samples, outcome === "unmount" ? 0 : 1);
    if (outcome !== "unmount") {
      assert.equal(
        effects[2](),
        undefined,
        "StrictMode must reuse the sampled artwork"
      );
      assert.equal(listeners.size, 0);
      assert.equal(timers.size, 0);
      assert.equal(samples, 1);
    }
    if (outcome === "ready") {
      const primary = properties.get("--yk-lr-glass-1").split(" ").map(Number);
      const secondary = properties
        .get("--yk-lr-glass-2")
        .split(" ")
        .map(Number);
      assert.ok(primary[0] > primary[2] + 50);
      assert.ok(secondary[2] > secondary[0] + 50);
      assert.equal(properties.size, 10);
    } else assert.equal(properties.size, 0);
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
