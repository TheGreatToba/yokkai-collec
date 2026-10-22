import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const original = read("data/lr-cinematic/reveal.html").replaceAll("\r\n", "\n");
const { lrCinematicDocument } = load("lib/ui/lr-cinematic-document.ts");

test("LR preview retains the supplied choreography and reduced-motion fallback", () => {
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    "d8b4918a8b3311e2fa0ab9a53393f0afe40057ba8aaa02ea68a55c5fc0fdbb06"
  );
  const html = lrCinematicDocument(
    original,
    new URLSearchParams(),
    "http://localhost:3000"
  );
  assert.match(html, /<html lang="en">/);
  assert.match(html, /aria-label="Yokkai legendary card reveal"/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /--card-hover-start:\s*19\.01s/);
  assert.match(html, /Nino Nakano/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src &#39;none&#39;/);
  assert.match(html, /form-action &#39;none&#39;/);
  // No new scripts, remote dependencies, or animation changes in the source.
  assert.equal((original.match(/<script>/g) ?? []).length, 1);
  assert.doesNotMatch(original, /(?:src|href)="https?:/);
});

test("card metadata is escaped and image protocols cannot inject scripts or CSS", () => {
  const params = new URLSearchParams({
    name: '<img src=x onerror="alert(1)"> $&',
    category: "ANIME/MANGA",
    license: "One & Two",
    image: "https://images.example/art.webp?q=</style><script>alert(1)</script>"
  });
  const html = lrCinematicDocument(original, params, "http://localhost:3000");
  assert.match(
    html,
    /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; \$&amp;/
  );
  assert.match(html, /<div class="license">One &amp; Two<\/div>/);
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
  assert.match(html, /\.art\{background-image:url\("https:\/\/images\.example/);
  for (const image of [
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "file:///private.txt",
    "http://remote.example/image.png",
    "https://user:pass@example.com/image.png",
    "not a url"
  ]) {
    assert.throws(() =>
      lrCinematicDocument(
        original,
        new URLSearchParams({ image }),
        "http://localhost:3000"
      )
    );
  }
  assert.throws(() =>
    lrCinematicDocument(
      original,
      new URLSearchParams({ name: "x".repeat(241) }),
      "http://localhost:3000"
    )
  );
});

test("pause messages require the parent window, its origin, and a boolean payload", () => {
  const html = lrCinematicDocument(
    original,
    new URLSearchParams(),
    "http://localhost:3000"
  );
  const bridge = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  let listener;
  const parent = {};
  const toggles = [];
  vm.runInNewContext(bridge, {
    parent,
    window: {
      addEventListener: (type, fn) => {
        assert.equal(type, "message");
        listener = fn;
      }
    },
    document: {
      documentElement: {
        classList: { toggle: (...args) => toggles.push(args) }
      }
    }
  });
  const valid = {
    source: parent,
    origin: "http://localhost:3000",
    data: { type: "yokkai-lr-pause", paused: true }
  };
  listener({ ...valid, source: {} });
  listener({ ...valid, origin: "https://evil.example" });
  listener({ ...valid, data: { ...valid.data, paused: "true" } });
  listener({ ...valid, data: null });
  assert.equal(toggles.length, 0);
  listener(valid);
  listener({ ...valid, data: { ...valid.data, paused: false } });
  assert.deepEqual(
    toggles.map(args => [...args]),
    [
      ["preview-paused", true],
      ["preview-paused", false]
    ]
  );
});

test("the preview document is unavailable outside development before reading files", async () => {
  for (const env of ["production", "test"]) {
    const { GET } = load(
      "app/design-system/lr-cinematic/document/route.ts",
      {
        "node:fs/promises": {
          readFile: () => assert.fail("Production must not read the prototype")
        },
        "@/lib/ui/lr-cinematic-document": { lrCinematicDocument }
      },
      { process: { env: { NODE_ENV: env } }, Response }
    );
    const response = await GET(
      new Request("http://localhost:3000/design-system/lr-cinematic/document")
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  }
});

test("the development route uses a fixed asset path and sends inert plain text", async () => {
  let reads = 0;
  const { GET } = load(
    "app/design-system/lr-cinematic/document/route.ts",
    {
      "node:fs/promises": {
        readFile: async (path, encoding) => {
          reads++;
          assert.match(
            path.replaceAll("\\", "/"),
            /\/data\/lr-cinematic\/reveal\.html$/
          );
          assert.equal(encoding, "utf8");
          return original;
        }
      },
      "@/lib/ui/lr-cinematic-document": { lrCinematicDocument }
    },
    {
      process: { env: { NODE_ENV: "development" }, cwd: () => "/workspace" },
      Response
    }
  );
  const result = await GET(
    new Request(
      "http://localhost:3000/design-system/lr-cinematic/document?name=Test"
    )
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(await result.text(), /<div class="name">Test<\/div>/);
  assert.equal(reads, 1);
  const invalid = await GET(
    new Request(
      "http://localhost:3000/design-system/lr-cinematic/document?image=javascript:alert(1)"
    )
  );
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(await invalid.text(), /javascript|workspace|stack/);
});

function descendants(element) {
  if (!element || typeof element !== "object") return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(descendants)
  ];
}

test("replay remounts the sandbox only, while pause and continue stay accessible", () => {
  const states = ["<!doctype html><title>Test</title>", false, 0, false];
  let index = 0;
  let continued = 0;
  const messages = [];
  const { LocalLrCinematic } = load(
    "components/local-lr-cinematic.tsx",
    {
      react: {
        ...React,
        useState: () => {
          const position = index++;
          return [
            states[position],
            next => {
              states[position] =
                typeof next === "function" ? next(states[position]) : next;
            }
          ];
        },
        useEffect: () => {},
        useRef: () => ({
          current: {
            contentWindow: { postMessage: (...args) => messages.push(args) }
          }
        })
      }
    },
    { process: { env: { NODE_ENV: "development" } } }
  );
  function render() {
    index = 0;
    return descendants(LocalLrCinematic({ onContinue: () => continued++ }));
  }
  const tree = render();
  const frame = tree.find(node => node.type === "iframe");
  assert.equal(frame.props.sandbox, "allow-scripts");
  assert.equal(frame.props.tabIndex, -1);
  assert.equal(frame.props.srcDoc, states[0]);
  assert.equal(frame.props.src, undefined);
  const button = label =>
    render().find(
      node => node.type === "button" && node.props.children === label
    );
  button("Pause animations").props.onClick();
  assert.equal(states[3], true);
  assert.equal(messages[0][0].type, "yokkai-lr-pause");
  assert.equal(messages[0][0].paused, true);
  button("Replay cinematic").props.onClick();
  assert.equal(states[2], 1);
  assert.equal(states[3], false);
  assert.notEqual(render().find(node => node.type === "iframe").key, frame.key);
  assert.equal(continued, 0);
  button("Continue").props.onClick();
  assert.equal(continued, 1);
  assert.doesNotMatch(
    read("components/local-lr-cinematic.tsx"),
    /\.rpc\(|createClient|openPack|onReveal/
  );
});

test("only development LR reveals use the new cinematic; other paths are preserved", () => {
  const source = read("components/boosters.tsx");
  const flip = source.slice(
    source.indexOf("  function flip()"),
    source.indexOf("  async function keep()")
  );
  assert.match(flip, /process\.env\.NODE_ENV === "development" && isLR/);
  assert.match(flip, /setSpot\(current\);[\s\S]*?return;/);
  assert.match(flip, /const revealDuration = isLR\s*\? 4400/);
  assert.match(source, /spot\.rarity === "LR" \? \(\s*<LocalLrCinematic/);
  assert.match(source, /Replay cinematic: \{card\.name\}/);
  const page = read("app/design-system/lr-cinematic/page.tsx");
  assert.match(page, /NODE_ENV !== "development"\) notFound\(\)/);
  assert.match(page, /No packs consumed, no collection changes/);
});

test("LR flip opens the preview immediately only in development without awarding cards", () => {
  for (const [environment, rarity, delay] of [
    ["development", "LR", null],
    ["production", "LR", 4400],
    ["development", "SSR", 3200],
    ["development", "SR", 520],
    ["development", "R", null]
  ]) {
    const states = [];
    const timers = [];
    const effects = [];
    const awards = [];
    let index = 0;
    const card = {
      id: "local-lr",
      instanceId: "local-instance",
      name: "Demo",
      rarity,
      category: "ANIME/MANGA",
      image: "https://example.com/card.webp"
    };
    const mocks = {
      react: {
        ...React,
        useState: initial => {
          const position = index++;
          if (!(position in states))
            states[position] =
              typeof initial === "function" ? initial() : initial;
          return [
            states[position],
            next => {
              states[position] =
                typeof next === "function" ? next(states[position]) : next;
            }
          ];
        },
        useRef: value => ({ current: value }),
        useEffect: fn => effects.push(fn),
        useCallback: fn => fn
      },
      "next/dynamic": { default: () => "LazyPreview" },
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
    };
    const { BoosterReveal } = load("components/boosters.tsx", mocks, {
      process: { env: { NODE_ENV: environment } },
      window: {
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        }
      }
    });
    const props = {
      cards: [card],
      revealed: 0,
      onReveal: value => awards.push(value),
      onReturn: () => {}
    };
    const render = () => {
      index = 0;
      effects.length = 0;
      return descendants(BoosterReveal(props));
    };
    render()
      .find(
        node =>
          node.type === "button" &&
          node.props["aria-label"] === "Reveal card 1 of 1"
      )
      .props.onClick();
    assert.equal(states[0], true);
    assert.deepEqual(awards, []);
    if (environment === "development" && rarity === "LR") {
      assert.equal(states[2], card);
      assert.equal(timers.length, 0);
      const modal = render().find(
        node => node.type === "Modal" && node.props.open
      );
      assert.match(modal.props.className, /yk-lr-file-modal/);
      modal.props.children.props.onContinue();
      assert.equal(states[2], null);
      // Closing/replaying is visual-only. The existing deposit effect owns progress.
      assert.deepEqual(awards, []);
    } else {
      assert.equal(states[2], null);
      assert.deepEqual(
        timers.map(timer => timer.ms),
        delay === null ? [] : [delay]
      );
    }
  }
});
