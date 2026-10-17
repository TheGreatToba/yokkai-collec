import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = file =>
  readFileSync(resolve(import.meta.dirname, "..", file), "utf8");
function load(
  file,
  require = () => {
    throw new Error("Unexpected dependency");
  },
  env = "test"
) {
  const compiled = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText,
    {
      exports: compiled.exports,
      module: compiled,
      require,
      process: { env: { NODE_ENV: env } }
    }
  );
  return compiled.exports;
}
const presets = load("lib/ui/local-profile-style.ts");
const storeModule = env =>
  load(
    "lib/ui/local-player-style-store.ts",
    id => {
      assert.equal(id, "@/lib/ui/local-profile-style");
      return presets;
    },
    env
  );
const factory = storeModule().createLocalPlayerStyleStore;
const style = {
  ...presets.DEFAULT_LOCAL_PROFILE_STYLE,
  font: "modern",
  effect: "neon",
  color: "#75e5bd",
  badges: ["comet", "bloom"]
};
const plain = value => JSON.parse(JSON.stringify(value));

test("styles follow account IDs, with stable immutable snapshots and no initial style", () => {
  const store = factory(true);
  assert.equal(store.get(), null);
  assert.equal(store.get("me"), null);
  const input = { ...style, badges: [...style.badges] };
  store.publish("me", input);
  const saved = store.get("me");
  assert.deepEqual(plain(saved), style);
  assert.equal(store.get("me"), saved);
  assert.equal(store.get("another-account"), null);
  input.badges.push("moon");
  assert.equal(saved.badges.length, 2);
  assert.ok(Object.isFrozen(saved));
  assert.ok(Object.isFrozen(saved.badges));
  assert.equal(
    factory(true).get("me"),
    null,
    "A fresh browser runtime has no stored style"
  );
});

test("subscribers receive applied updates and can unsubscribe", () => {
  const store = factory(true);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.publish("me", style);
  const first = store.get("me");
  store.publish("me", { ...style, effect: "solid" });
  assert.notEqual(store.get("me"), first);
  assert.equal(store.get("me").effect, "solid");
  assert.equal(notifications, 2);
  unsubscribe();
  store.publish("me", style);
  assert.equal(notifications, 2);
});

test("shared styles normalize unsafe input and never activate outside development", () => {
  const store = factory(true);
  store.publish("me", {
    ...style,
    font: "url(evil)",
    color: "red;display:none",
    badges: ["comet", "comet", "invalid", "moon", "orbit", "flame"]
  });
  assert.equal(store.get("me").font, "classic");
  assert.equal(store.get("me").color, "#eeebff");
  assert.deepEqual(plain(store.get("me").badges), ["comet", "moon", "orbit"]);
  for (const env of ["production", "test", "development"]) {
    const runtime = storeModule(env).localPlayerStyles;
    runtime.publish("me", style);
    assert.equal(runtime.get("me") !== null, env === "development");
  }
  let notified = false;
  const disabled = factory(false);
  disabled.subscribe(() => {
    notified = true;
  });
  disabled.publish("me", style);
  assert.equal(disabled.get("me"), null);
  assert.equal(notified, false);
  store.publish("", style);
  assert.equal(store.get(""), null);
});

test("auction messages and wall authors share the same identity renderer without writes", () => {
  const chat = source("components/community-views.tsx");
  assert.match(
    chat,
    /<StyledPlayerName\s+userId=\{item\.userId\}\s+name=\{item\.pseudo\}/
  );
  assert.match(chat, /fallbackLabel=\{item\.mine \? "You" : item\.pseudo\}/);
  const wall = source("components/profile-wall.tsx");
  assert.equal(
    (wall.match(/<StyledPlayerName userId=\{ownerId\} name=\{pseudo\}/g) ?? [])
      .length,
    2
  );
  const renderer = source("components/styled-player-name.tsx");
  assert.match(renderer, /if \(!style\) return <>\{fallbackLabel\}<\/>/);
  assert.match(renderer, /CosmeticBadges badges=\{style\.badges\} inline/);
  assert.match(renderer, /LocalProProfileBadge/);
  const hook = source("components/use-local-player-style.ts");
  assert.match(hook, /useSyncExternalStore/);
  assert.match(hook, /const noServerStyle = \(\) => null/);
  for (const file of [
    "lib/ui/local-player-style-store.ts",
    "components/styled-player-name.tsx",
    "components/use-local-player-style.ts",
    "components/local-profile-style-context.tsx"
  ]) {
    assert.doesNotMatch(
      source(file),
      /localStorage|sessionStorage|\.rpc\(|fetch\(/
    );
  }
  const route = source(
    "app/design-system/profile-style-sharing-preview/page.tsx"
  );
  assert.match(route, /if \(!localPremiumEnabled\(\)\) notFound\(\)/);
  assert.match(route, /if \(!user\) redirect\("\/login"\)/);
  const preview = source("components/profile-style-sharing-preview.tsx");
  assert.match(preview, /send: readOnly/);
  assert.match(preview, /publish: readOnly/);
  assert.match(preview, /report: readOnly/);
  assert.match(preview, /isMe=\{false\}/);
});
