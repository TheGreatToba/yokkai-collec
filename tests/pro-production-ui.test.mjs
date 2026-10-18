import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const path = resolve(root, file);
    if (cache.has(path)) return cache.get(path);
    const loaded = { exports: {} };
    cache.set(path, loaded.exports);
    vm.runInNewContext(
      ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true
        }
      }).outputText,
      {
        module: loaded,
        exports: loaded.exports,
        URL,
        AbortController,
        ...globals,
        require: id => {
          if (id in mocks) return mocks[id];
          if (id === "next/link")
            return {
              __esModule: true,
              default: ({ children, ...props }) =>
                React.createElement("a", props, children)
            };
          if (id.startsWith("@/lib/ui/")) return load(id.slice(2) + ".ts");
          if (id.startsWith("@/components/")) return load(id.slice(2) + ".tsx");
          return require(id);
        }
      }
    );
    return loaded.exports;
  }
  return load;
}

test("Pro name rendering follows its owner's server projection, not the viewing player's membership", () => {
  const load = loader();
  const { StyledPlayerName } = load("components/styled-player-name.tsx");
  const basic = renderToStaticMarkup(
    React.createElement(StyledPlayerName, {
      name: "Basic",
      cosmetics: { active: false, style: { effect: "neon" } }
    })
  );
  assert.equal(basic, "Basic");
  const paid = renderToStaticMarkup(
    React.createElement(StyledPlayerName, {
      name: "ProOwner",
      cosmetics: { active: true, style: { effect: "neon", badges: ["comet"] } }
    })
  );
  assert.match(paid, /data-name-effect="neon"/);
  assert.match(paid, /aria-label="Yokkai Pro"/);
  assert.match(paid, /comet decorative badge/);
  assert.doesNotMatch(paid, /local preview|verified role/i);
});
test("Basic style controls are disabled with an upgrade notice; paid core style controls remain usable", () => {
  for (const pro of [false, true]) {
    const load = loader({
      "@/components/pro-access": {
        useProAccess: () => pro,
        ProFeatureNotice: () =>
          React.createElement("p", null, "Pro members only")
      }
    });
    const { DEFAULT_PROFILE_STYLE } = load("lib/ui/profile-style.ts");
    const { ProfileStyleFields } = load("components/profile-style-fields.tsx");
    const html = renderToStaticMarkup(
      React.createElement(ProfileStyleFields, {
        name: "Owner",
        value: DEFAULT_PROFILE_STYLE,
        busy: false,
        onChange: () => {}
      })
    );
    if (pro) {
      assert.doesNotMatch(html, /<fieldset disabled/);
      assert.doesNotMatch(html, /Pro members only/);
    } else {
      assert.match(html, /<fieldset disabled/);
      assert.match(html, /Pro members only/);
    }
    assert.match(html, /Avatar frame/);
    assert.match(html, /Profile theme/);
    assert.match(html, /Showcase effect/);
    assert.doesNotMatch(html, /Site background|Card back/);
    assert.doesNotMatch(html, /type="file"/);
  }
});
test("presentation normalizes CSS enums, hex colors, badge limits and safe uploaded media", () => {
  const { normalizeProfileStyle, DEFAULT_PROFILE_STYLE, safeStyleMedia } =
    loader()("lib/ui/profile-style.ts");
  const value = normalizeProfileStyle({
    ...DEFAULT_PROFILE_STYLE,
    color: "url(javascript:bad)",
    font: "bad font",
    badges: ["comet", "comet", "flame", "moon", "bloom", "unknown"],
    backgroundUrl: "javascript:alert(1)"
  });
  assert.equal(value.color, "#eeebff");
  assert.equal(value.font, "classic");
  assert.equal(value.badges.length, 3);
  assert.ok(!value.backgroundUrl);
  assert.equal(
    safeStyleMedia(
      "https://example.test/storage/v1/object/public/avatars/owner/background.png"
    ),
    true
  );
  assert.equal(
    safeStyleMedia(
      "https://user:password@example.test/storage/v1/object/public/avatars/a.png"
    ),
    false
  );
});
test("membership synchronization grants only a strict server boolean and drops presentation access after failure", async () => {
  let effect;
  const states = [];
  let stateIndex = 0;
  const listeners = new Map();
  const window = {
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 2,
    clearInterval() {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name)
  };
  const document = {
    visibilityState: "visible",
    addEventListener: window.addEventListener,
    removeEventListener: window.removeEventListener
  };
  let active = true,
    failed = false,
    styleActive = true,
    styleAvailable = true;
  const fakeReact = {
    ...React,
    useEffect: fn => {
      effect = fn;
    },
    useState: initial => {
      const index = stateIndex++;
      states[index] = initial;
      return [
        initial,
        next => {
          states[index] = next;
        }
      ];
    }
  };
  const load = loader(
    { react: fakeReact },
    {
      window,
      document,
      fetch: async path => {
        if (failed) throw Error("offline");
        return {
          ok: path.endsWith("benefits") || styleAvailable,
          json: async () =>
            path.endsWith("benefits")
              ? { active }
              : { active: styleActive, style: { effect: "neon" } }
        };
      }
    }
  );
  load("components/pro-access.tsx").ProAccessProvider({ children: null });
  const stop = effect();
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  assert.equal(states[0], true);
  assert.equal(states[1].effect, "neon");
  active = "true";
  listeners.get("focus")();
  await flush();
  assert.equal(states[0], false);
  assert.equal(states[1], null);
  active = true;
  listeners.get("focus")();
  await flush();
  assert.equal(states[0], true);
  styleActive = false;
  listeners.get("focus")();
  await flush();
  assert.equal(states[0], false);
  styleActive = true;
  styleAvailable = false;
  listeners.get("focus")();
  await flush();
  assert.equal(states[0], false);
  styleAvailable = true;
  failed = true;
  listeners.get("online")();
  await flush();
  assert.equal(states[0], false);
  assert.equal(states[1], null);
  stop();
  assert.equal(listeners.size, 0);
});
test("sales actions point to account settings and never create a second or simulated checkout", () => {
  const source = readFileSync(
    resolve(root, "components/premium-checkout.tsx"),
    "utf8"
  );
  assert.match(source, /\/settings#subscription/);
  assert.match(source, /billing\?\.checkoutEnabled/);
  assert.doesNotMatch(
    source,
    /\/api\/premium|localStorage|localPremiumEnabled|STRIPE_SECRET/
  );
  for (const file of [
    "components/profile.tsx",
    "components/community-views.tsx",
    "components/profile-wall.tsx"
  ])
    assert.match(readFileSync(resolve(root, file), "utf8"), /StyledPlayerName/);
  const offer = readFileSync(resolve(root, "lib/premium/offer.ts"), "utf8");
  assert.match(offer, /Coming soon/);
  assert.match(offer, /reward Karas|Karas rewards/);
});
