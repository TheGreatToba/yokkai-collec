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
  assert.match(paid, /data-pro-badge="true"/);
  assert.match(paid, /yk-profile-pro-badge-check/);
  assert.match(paid, /comet decorative badge/);
  assert.doesNotMatch(paid, /local preview|verified role/i);
});
test("Basic players can preview profile styles while the controls stay usable", () => {
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
    assert.doesNotMatch(html, /<fieldset disabled/);
    if (pro) {
      assert.match(html, /PRO ACTIVE/);
      assert.doesNotMatch(html, /PREVIEW ONLY|live profile stays unchanged/);
    } else {
      assert.match(html, /PREVIEW ONLY/);
      assert.match(html, /Try every option and preview the result here/);
      assert.match(html, /live profile stays unchanged/);
      assert.match(html, /href="\/premium"/);
    }
    assert.match(html, /aria-label="Profile style preview"/);
    assert.match(html, /yk-style-workspace/);
    assert.match(html, /LIVE PREVIEW/);
    assert.match(html, /data-profile-theme="default"/);
    assert.match(html, /data-avatar-frame="none"/);
    assert.match(html, /data-showcase-effect="none"/);
    assert.match(html, /aria-label="Yokkai Pro"/);
    assert.match(html, /Avatar frame/);
    assert.match(html, /Name colors/);
    assert.match(html, /aria-label="Primary R"/);
    assert.match(html, /aria-label="Primary G"/);
    assert.match(html, /aria-label="Primary B"/);
    assert.match(html, /aria-label="Accent R"/);
    assert.match(html, /Showcase effect/);
    assert.doesNotMatch(html, /Site background|Card back/);
    assert.doesNotMatch(html, /type="file"/);
  }
});
test("presentation normalizes CSS enums, hex colors, badge limits and safe uploaded media", () => {
  const {
    normalizeProfileStyle,
    DEFAULT_PROFILE_STYLE,
    profileThemeVariables,
    safeStyleMedia
  } = loader()("lib/ui/profile-style.ts");
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
  const themeVariables = profileThemeVariables({
    ...DEFAULT_PROFILE_STYLE,
    color: "#123456",
    secondary: "#abcdef"
  });
  assert.equal(themeVariables["--profile-theme-primary"], "#123456");
  assert.equal(themeVariables["--profile-theme-accent"], "#abcdef");
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
