import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = file =>
  readFileSync(resolve(import.meta.dirname, "..", file), "utf8");
function policy({
  enabled = true,
  state = { active: false, configured: false },
  reject = false
} = {}) {
  const compiled = { exports: {} };
  const users = [];
  vm.runInNewContext(
    ts.transpileModule(source("lib/premium/card-customization.ts"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText,
    {
      exports: compiled.exports,
      module: compiled,
      require(id) {
        if (id === "server-only") return {};
        if (id === "./plan") return { localPremiumEnabled: () => enabled };
        if (id === "./server")
          return {
            getPremiumState: async userId => {
              users.push(userId);
              if (reject) throw new Error("Provider unavailable");
              return state;
            }
          };
        throw new Error("Unexpected dependency: " + id);
      }
    }
  );
  return { read: compiled.exports.getLocalCardCustomizationAccess, users };
}

test("the local customization trial allows only a configured active subscription", async () => {
  for (const [active, configured, expected] of [
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true]
  ]) {
    const api = policy({ state: { active, configured } });
    assert.equal(await api.read("authenticated-account"), expected);
    assert.deepEqual(api.users, ["authenticated-account"]);
  }
});

test("subscription failures close local access and a disabled trial leaves existing rights unchanged", async () => {
  assert.equal(await policy({ reject: true }).read("me"), false);
  const disabled = policy({ enabled: false, reject: true });
  assert.equal(await disabled.read("me"), null);
  assert.deepEqual(disabled.users, []);
});

test("collection and pack details share the gate; removing an old custom image remains possible", () => {
  for (const page of ["app/collection/page.tsx", "app/boosters/page.tsx"]) {
    assert.match(
      source(page),
      /<LocalCardCustomizationBoundary userId=\{user.id\}/
    );
    assert.match(source(page), /if \(!user\) redirect\("\/login"\)/);
  }
  const collection = source("components/collection.tsx");
  assert.match(
    collection.replace(/\s/g, ""),
    /disabled=\{!canCustomizeImages\|\|imageBusy\|\|!customImageUrl.trim\(\)\}/
  );
  assert.match(
    collection,
    /if \(imageUrl !== null && !canCustomizeImages\) return/
  );
  assert.match(collection, /detail-custom-image-pro-notice/);
  assert.match(
    source("components/game.tsx"),
    /if \(imageUrl !== null && !canCustomizeImages\)\s*throw new Error\(PRO_CARD_CUSTOMIZATION_MESSAGE\)/
  );
  assert.match(
    source("components/card-customization-access.tsx"),
    /Card customization is available to Pro members only\./
  );
  assert.doesNotMatch(
    source("lib/premium/card-customization.ts"),
    /localStorage|localPlayerStyles|badge|stripe.*create/i
  );
});

test("the save handler rejects Basic artwork changes before the mutation, but permits Pro and restoration", async () => {
  const ast = ts.createSourceFile(
    "game.tsx",
    source("components/game.tsx"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let handler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "customizeCard")
      handler = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(handler);
  const code = ts.transpileModule("export " + handler.getText(ast), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  for (const [allowed, url, shouldSave] of [
    [false, "https://i.imgur.com/new.png", false],
    [true, "https://i.imgur.com/new.png", true],
    [false, null, true]
  ]) {
    const calls = [];
    const compiled = { exports: {} };
    vm.runInNewContext(code, {
      exports: compiled.exports,
      module: compiled,
      previewData: undefined,
      canCustomizeImages: allowed,
      PRO_CARD_CUSTOMIZATION_MESSAGE:
        "Card customization is available to Pro members only.",
      setCardCustomImage: async (...args) => {
        calls.push(args);
      },
      getUserCollection: async () => [],
      setCollection() {}
    });
    const result = compiled.exports.customizeCard("owned-card", url);
    if (shouldSave) {
      await result;
      assert.deepEqual(calls, [["owned-card", url]]);
    } else {
      await assert.rejects(result, {
        message: "Card customization is available to Pro members only."
      });
      assert.deepEqual(calls, []);
    }
  }
});
