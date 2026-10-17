import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = file =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
function evaluate(code, globals = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true
      }
    }).outputText,
    { exports: compiled.exports, module: compiled, require, Error, ...globals }
  );
  return compiled.exports;
}
const presets = evaluate(source("lib/ui/local-profile-style.ts"));
function fixture(allowed, busy = false) {
  const drafts = [];
  const ui = evaluate(source("components/local-profile-style-preview.tsx"), {
    require: id => {
      if (id === "@/lib/ui/local-profile-style") return presets;
      if (id === "@/components/local-profile-style-context")
        return {
          useLocalProfileStyle: () => ({
            style: presets.DEFAULT_LOCAL_PROFILE_STYLE
          })
        };
      if (id === "@/components/card-customization-access")
        return {
          useCardCustomizationAccess: () => allowed,
          PRO_PROFILE_STYLE_MESSAGE:
            "Profile styling is available to Pro members only."
        };
      if (id === "@/components/ui")
        return {
          Avatar: () => null,
          Button: ({ children, disabled, onClick }) =>
            React.createElement("button", { disabled, onClick }, children)
        };
      if (id === "@/components/local-pro-badge-preview")
        return { LocalProProfileBadge: () => null };
      if (id === "next/link") return { __esModule: true, default: "a" };
      if (id === "next/image") return { __esModule: true, default: "img" };
      return require(id);
    }
  });
  const element = ui.EmbeddedProfileStyleEditor({
    ownerId: "owner",
    name: "Collector",
    isMe: true,
    busy,
    onDraftChange: draft => drafts.push(draft)
  });
  return { element, html: renderToStaticMarkup(element), drafts };
}

test("Edit profile contains the style section instead of a separate live Style profile action", () => {
  const profile = source("components/profile.tsx");
  assert.doesNotMatch(profile, /<LocalProfileStyleEditor/);
  assert.match(profile, /<EmbeddedProfileStyleEditor/);
  assert.match(profile, /onDraftChange=\{setStyleDraft\}/);
  assert.match(profile, /mode === "profile"/);
  const alias = source("app/profile/[id]/page.tsx");
  assert.match(alias, /localPremiumEnabled\(\)/);
  assert.match(alias, /LocalProfileStyleProvider/);
});

test("Basic can see every style option but all style controls are disabled without locking the profile editor", () => {
  const basic = fixture(false);
  assert.match(
    basic.html,
    /Profile styling is available to Pro members only\./
  );
  assert.match(
    basic.html,
    /<fieldset[^>]*disabled=""[^>]*aria-label="Profile style settings"/
  );
  assert.match(basic.html, /aria-describedby="embedded-profile-style-notice"/);
  assert.equal((basic.html.match(/data-font=/g) ?? []).length, 8);
  assert.equal((basic.html.match(/data-effect=/g) ?? []).length, 7);
  assert.equal((basic.html.match(/data-badge=/g) ?? []).length, 6);
  assert.doesNotMatch(basic.html, /Apply locally|>Cancel</);
  assert.match(basic.html, /href="\/premium">Discover Yokkai Pro/);
  const fieldset = React.Children.toArray(basic.element.props.children).find(
    child => child.type === "fieldset"
  );
  assert.equal(fieldset.props.children.props.onDraftChange, undefined);
  assert.deepEqual(basic.drafts, []);
  assert.match(
    source("styles/profile-style.css"),
    /\.yk-style-embedded-fields:disabled/
  );
});

test("Pro can edit the embedded controls, has no second Save/Cancel pair, and controls disable while saving", () => {
  const pro = fixture(true);
  assert.doesNotMatch(
    pro.html,
    /disabled=""|Pro members only|Apply locally|>Cancel</
  );
  const fieldset = React.Children.toArray(pro.element.props.children).find(
    child => child.type === "fieldset"
  );
  assert.equal(fieldset.props.children.props.embedded, true);
  fieldset.props.children.props.onDraftChange(
    presets.DEFAULT_LOCAL_PROFILE_STYLE
  );
  assert.equal(pro.drafts.length, 1);
  assert.match(fixture(true, true).html, /<fieldset[^>]*disabled=""/);
});

test("the single Save applies the local draft only after profile save succeeds, never for Basic or showcase", async () => {
  const tree = ts.createSourceFile(
    "profile.tsx",
    source("components/profile.tsx"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let submit;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "submit")
      submit = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(submit);
  for (const [allowed, mode, fails, expected] of [
    [true, "profile", false, true],
    [false, "profile", false, false],
    [true, "showcase", false, false],
    [true, "profile", true, false]
  ]) {
    const calls = [],
      errors = [];
    const api = evaluate("export " + submit.getText(tree), {
      busy: false,
      mode,
      canCustomizeMedia: allowed,
      styleDraft: presets.DEFAULT_LOCAL_PROFILE_STYLE,
      bannerFile: null,
      bannerUrl: null,
      bannerCard: null,
      bannerFrame: null,
      framingAvailable: true,
      ownedBannerCards: [],
      bio: "Bio",
      avatar: null,
      selected: new Set(),
      setBusy() {},
      setError: error => errors.push(error),
      adapter: {
        saveAppearance: async () => {
          calls.push("save");
          if (fails) throw new Error("Save failed");
          return {};
        }
      },
      localStyle: { apply: () => calls.push("apply") },
      onSaved: () => calls.push("saved"),
      onClose: () => calls.push("close")
    });
    await api.submit();
    assert.equal(calls.includes("apply"), expected);
    if (expected) assert.deepEqual(calls, ["save", "apply", "saved", "close"]);
    if (fails) {
      assert.deepEqual(calls, ["save"]);
      assert.equal(errors.at(-1), "Save failed");
    }
  }
});
