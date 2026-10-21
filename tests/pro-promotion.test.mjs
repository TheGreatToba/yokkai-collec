import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true
      }
    }).outputText,
    {
      exports,
      AbortController,
      ...globals,
      require: name => {
        if (name in mocks) return mocks[name];
        if (name.endsWith(".css")) return {};
        if (name === "next/link")
          return {
            __esModule: true,
            default: ({ children, ...props }) =>
              React.createElement("a", props, children)
          };
        if (name === "@/lib/ui/pro-promotion")
          return load("lib/ui/pro-promotion.ts");
        return require(name);
      }
    }
  );
  return exports;
}
test("promotion snooze lasts exactly seven days and rejects invalid or future values", () => {
  const { proPromotionDismissed, PRO_PROMOTION_SNOOZE } = load(
    "lib/ui/pro-promotion.ts"
  );
  const now = 2_000_000_000_000;
  assert.equal(PRO_PROMOTION_SNOOZE, 604800000);
  for (const value of [
    null,
    "",
    " ",
    "invalid",
    "NaN",
    "Infinity",
    "-1",
    "0",
    String(now + 1)
  ])
    assert.equal(proPromotionDismissed(value, now), false);
  assert.equal(proPromotionDismissed(String(now), now), true);
  assert.equal(
    proPromotionDismissed(String(now - PRO_PROMOTION_SNOOZE + 1), now),
    true
  );
  assert.equal(
    proPromotionDismissed(String(now - PRO_PROMOTION_SNOOZE), now),
    false
  );
});

test("banner has a single offer link, an accessible close action and no checkout or urgency", () => {
  const { ProPromotionBanner } = load("components/pro-promotion.tsx", {
    "@/components/pro-access": { useProMembershipStatus: () => null }
  });
  const html = renderToStaticMarkup(
    React.createElement(ProPromotionBanner, { onDismiss() {} })
  );
  assert.match(html, /aria-label="Discover Yokkai Pro"/);
  assert.match(html, /Make it yours/);
  assert.match(html, /Your images\. Your GIFs/);
  assert.match(html, /Faster packs/);
  assert.equal((html.match(/href="\/premium"/g) || []).length, 1);
  assert.match(html, /aria-label="Hide Pro promotion for 7 days"/);
  assert.doesNotMatch(
    html,
    /checkout|limited.time|last.chance|role="dialog"|autofocus|€|\$/i
  );
});

function harness(initialStatus) {
  let status = initialStatus,
    visible = false,
    effect,
    storageBlocked = false;
  const storage = new Map(),
    timers = new Map(),
    listeners = new Map();
  const fakeReact = {
    ...React,
    useState: () => [
      visible,
      next => {
        visible = next;
      }
    ],
    useEffect: fn => {
      effect = fn;
    }
  };
  const { ProPromotion } = load(
    "components/pro-promotion.tsx",
    {
      react: fakeReact,
      "@/components/pro-access": { useProMembershipStatus: () => status }
    },
    {
      localStorage: {
        getItem: key => {
          if (storageBlocked) throw Error("blocked");
          return storage.get(key) ?? null;
        },
        setItem: (key, value) => {
          if (storageBlocked) throw Error("blocked");
          storage.set(key, value);
        }
      },
      window: {
        setTimeout: fn => {
          timers.set(1, fn);
          return 1;
        },
        clearTimeout: id => timers.delete(id),
        addEventListener: (key, fn) => listeners.set(key, fn),
        removeEventListener: key => listeners.delete(key)
      }
    }
  );
  return {
    render: (enabled = true) => ProPromotion({ enabled }),
    start: () => effect(),
    flush: () => {
      for (const fn of timers.values()) fn();
      timers.clear();
    },
    storage,
    listeners,
    timers,
    setStatus: value => {
      status = value;
    },
    block: () => {
      storageBlocked = true;
    }
  };
}
test("promotion waits for verified Basic status and never flashes for Pro, anonymous or unknown status", () => {
  for (const status of [null, true]) {
    const s = harness(status);
    assert.equal(s.render(), null);
    s.start();
    s.flush();
    assert.equal(s.render(), null);
    assert.equal(s.listeners.size, 0);
  }
  const s = harness(false);
  assert.equal(s.render(), null);
  const stop = s.start();
  s.flush();
  assert.ok(s.render());
  s.setStatus(true);
  assert.equal(s.render(), null);
  s.setStatus(null);
  assert.equal(s.render(), null);
  stop();
  assert.equal(s.listeners.size, 0);
  const disabled = harness(false);
  assert.equal(disabled.render(false), null);
  disabled.start();
  disabled.flush();
  assert.equal(disabled.render(false), null);
});
test("dismissal persists, syncs between tabs, and stays closable when storage is blocked", () => {
  const key = "yokkai:pro-promotion:v1:dismissed-at";
  const s = harness(false);
  s.render();
  const stop = s.start();
  s.flush();
  s.render().props.onDismiss();
  assert.equal(s.render(), null);
  assert.ok(Number(s.storage.get(key)) > 0);
  s.storage.delete(key);
  s.listeners.get("storage")({ key });
  assert.ok(s.render());
  s.storage.set(key, String(Date.now()));
  s.listeners.get("storage")({ key });
  assert.equal(s.render(), null);
  stop();
  const blocked = harness(false);
  blocked.block();
  blocked.render();
  blocked.start();
  blocked.flush();
  assert.ok(blocked.render());
  blocked.render().props.onDismiss();
  assert.equal(blocked.render(), null);
});
test("integration reuses the existing membership request and does not advertise on admin/settings", () => {
  const source = readFileSync("components/pro-access.tsx", "utf8");
  assert.match(
    source,
    /setMembership\(typeof result\?\.active === "boolean" \? result\.active : null\)/
  );
  assert.equal(
    (source.match(/fetch\("\/api\/pro\/benefits"/g) || []).length,
    1
  );
  assert.doesNotMatch(
    readFileSync("components/pro-promotion.tsx", "utf8"),
    /fetch\(|checkout|createClient/
  );
  const topbar = readFileSync("components/topbar.tsx", "utf8");
  assert.match(
    topbar,
    /<ProPromotion[\s\S]*?secondaryReady && view !== "admin" && view !== "settings"/
  );
});

test("membership status distinguishes Basic, Pro without profile style, and unavailable responses", async () => {
  for (const scenario of [
    { active: false, expected: false },
    { active: true, expected: true },
    { active: "false", expected: null },
    { active: null, expected: null },
    { active: false, unavailable: true, expected: null },
    { active: false, offline: true, expected: null }
  ]) {
    let effect,
      index = 0;
    const states = [];
    const react = {
      ...React,
      useEffect: fn => {
        effect = fn;
      },
      useState: initial => {
        const current = index++;
        states[current] = initial;
        return [
          initial,
          value => {
            states[current] = value;
          }
        ];
      }
    };
    const window = {
      setTimeout: () => 1,
      clearTimeout() {},
      setInterval: () => 2,
      clearInterval() {},
      addEventListener() {},
      removeEventListener() {}
    };
    const document = {
      visibilityState: "visible",
      addEventListener() {},
      removeEventListener() {}
    };
    const { ProAccessProvider } = load(
      "components/pro-access.tsx",
      {
        react,
        "@/lib/ui/profile-style": {
          DEFAULT_PROFILE_STYLE: {},
          normalizeProfileStyle: value => value
        }
      },
      {
        window,
        document,
        fetch: async path => {
          if (scenario.offline) throw Error("offline");
          return {
            ok: path.endsWith("benefits") && !scenario.unavailable,
            json: async () => ({ active: scenario.active })
          };
        }
      }
    );
    ProAccessProvider({ children: null });
    assert.equal(states[2], null);
    const stop = effect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(states[2], scenario.expected, JSON.stringify(scenario));
    assert.equal(
      states[0],
      false,
      "Unavailable profile style must not grant customization access"
    );
    stop();
  }
});
