import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import postcss from "postcss";

const require = createRequire(import.meta.url);
const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

function loadPage(environment, user) {
  let calls = 0;
  const Game = () => null;
  const LocalBoosterComparison = () => null;
  const context = {
    exports: {},
    process: { env: { NODE_ENV: environment } },
    require(name) {
      if (name === "@/components/game") return { Game };
      if (name === "@/components/local-booster-comparison")
        return { LocalBoosterComparison };
      if (name === "@/components/account-menu")
        return { AccountMenu: () => null };
      if (name === "@/lib/auth/session")
        return {
          getCurrentUser: async () => {
            calls++;
            return user;
          }
        };
      if (name === "next/navigation")
        return {
          redirect: url => {
            throw Error(`redirect:${url}`);
          }
        };
      return require(name);
    }
  };
  vm.runInNewContext(
    ts.transpileModule(read("app/boosters/page.tsx"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX
      }
    }).outputText,
    context
  );
  return {
    page: context.exports.default,
    Game,
    LocalBoosterComparison,
    calls: () => calls
  };
}

test("local boosters default to an isolated comparison without account reads", async () => {
  const { page, LocalBoosterComparison, calls } = loadPage("development", null);
  const result = await page({ searchParams: Promise.resolve({}) });
  assert.equal(result.type, LocalBoosterComparison);
  assert.equal(calls(), 0);
});

test("production always authenticates and renders the real game, never the demo", async () => {
  for (const live of [undefined, "0", "1"]) {
    const { page, Game, calls } = loadPage("production", { id: "real-user" });
    const result = await page({ searchParams: Promise.resolve({ live }) });
    assert.equal(result.type, Game);
    assert.equal(result.props.view, "packs");
    assert.equal(calls(), 1);
    const anonymous = loadPage("production", null);
    await assert.rejects(
      anonymous.page({ searchParams: Promise.resolve({ live }) }),
      /redirect:\/connexion/
    );
  }
});

test("live=1 keeps the real authenticated local game available", async () => {
  const { page, Game, calls } = loadPage("development", { id: "local-user" });
  assert.equal(
    (await page({ searchParams: Promise.resolve({ live: "1" }) })).type,
    Game
  );
  assert.equal(calls(), 1);
});

test("every native override is gated so Before falls back to unchanged production CSS", () => {
  let checked = 0;
  postcss.parse(read("styles/boosters-native.css")).walkRules(rule => {
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === "atrule" && /keyframes$/.test(parent.name)) return;
    }
    for (const selector of rule.selectors) {
      assert.ok(
        selector.startsWith(':root:not([data-drop-animation="before"])'),
        selector
      );
      checked++;
    }
  });
  assert.ok(checked > 20);
  const source = read("components/local-booster-comparison.tsx");
  assert.doesNotMatch(source, /createClient|\.rpc\(|fetch\(|openRegularPack\(/);
  assert.match(source, /card\.rarity === "SSR" \|\| card\.rarity === "LR"/);
  assert.match(source, /root\.removeAttribute\("data-drop-animation"\)/);
});
