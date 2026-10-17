import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = name =>
  readFileSync(new URL("../" + name, import.meta.url), "utf8");
function evaluate(code, globals = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      }
    }).outputText,
    { exports: compiled.exports, module: compiled, require, ...globals }
  );
  return compiled.exports;
}
const media = evaluate(source("lib/ui/pro-profile-media.ts"));
const tree = ts.createSourceFile(
  "profile.tsx",
  source("components/profile.tsx"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node))
    functions.set(node.name?.text, node.getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
const gif = (name = "avatar.gif", type = "image/gif") =>
  new File(["GIF89a", new Uint8Array(20)], name, { type });
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10])], "avatar.png", {
    type: "image/png"
  });

test("GIF avatars are detected by MIME, filename and actual bytes, including renamed files", async () => {
  for (const file of [
    gif(),
    gif("avatar.GIF", "image/png"),
    gif("avatar.png", "image/png"),
    new File(["GIF87a"], "avatar.jpg", { type: "image/jpeg" })
  ]) {
    assert.equal(await media.isGifProfilePhoto(file), true);
  }
  assert.equal(await media.isGifProfilePhoto(png()), false);
});

test("Basic rejects GIF photos before upload; fixed images and Pro GIF photos still work", async () => {
  for (const [allowed, file, expected] of [
    [false, gif(), 0],
    [false, gif("renamed.png", "image/png"), 0],
    [false, png(), 1],
    [true, gif(), 1]
  ]) {
    const uploads = [],
      errors = [],
      avatars = [],
      busy = [];
    const { photo } = evaluate("export " + functions.get("photo"), {
      busy: false,
      canCustomizeMedia: allowed,
      profile: { id: "verified-owner" },
      ...media,
      setBusy: value => busy.push(value),
      setError: value => errors.push(value),
      setAvatar: value => avatars.push(value),
      adapter: {
        uploadAvatar: async (...args) => {
          uploads.push(args);
          return "/new-avatar";
        }
      }
    });
    await photo(file);
    assert.equal(uploads.length, expected);
    assert.equal(avatars.length, expected);
    assert.deepEqual(busy, [true, false]);
    if (!expected) assert.equal(errors.at(-1), media.PRO_AVATAR_GIF_MESSAGE);
    if (expected) assert.equal(uploads[0][1], "verified-owner");
  }
});

test("Basic cannot submit a new uploaded banner, but can save a bio with an existing banner", async () => {
  for (const [allowed, newFile, shouldSave] of [
    [false, png(), false],
    [true, gif(), true],
    [false, null, true]
  ]) {
    const uploads = [],
      saves = [],
      errors = [];
    const { submit } = evaluate("export " + functions.get("submit"), {
      busy: false,
      mode: "profile",
      styleDraft: null,
      localStyle: null,
      canCustomizeMedia: allowed,
      bannerFile: newFile,
      bannerUrl: "/existing-banner.gif",
      bannerFrame: null,
      framingAvailable: true,
      bannerCard: null,
      ownedBannerCards: [],
      profile: { id: "verified-owner" },
      bio: "Updated bio",
      avatar: "/existing-avatar.gif",
      selected: new Set(),
      ...media,
      setBusy() {},
      setError: error => errors.push(error),
      onSaved() {},
      onClose() {},
      adapter: {
        uploadBanner: async (...args) => {
          uploads.push(args);
          return "/new-banner.gif";
        },
        saveAppearance: async (...args) => {
          saves.push(args);
          return {};
        }
      }
    });
    await submit();
    assert.equal(saves.length, Number(shouldSave));
    assert.equal(uploads.length, Number(allowed && !!newFile));
    if (!shouldSave) assert.equal(errors.at(-1), media.PRO_BANNER_MESSAGE);
    if (!newFile) {
      assert.equal(saves[0][0], "Updated bio");
      assert.equal(saves[0][1], "/existing-avatar.gif");
      assert.equal(saves[0][4], "/existing-banner.gif");
    }
  }
});

function renderEditor(allowed, existingBanner = null) {
  const { Editor } = evaluate("export " + functions.get("Editor"), {
    ...React,
    useLocalProfileStyle: () => null,
    EmbeddedProfileStyleEditor: () => null,
    ...media,
    useCardCustomizationAccess: () => allowed,
    Avatar: () => null,
    BannerImage: () => null,
    BannerCrop: () => null,
    YokaiCard: () => null,
    Button: ({ children, disabled, onClick }) =>
      React.createElement("button", { disabled, onClick }, children),
    Link: ({ children, ...props }) => React.createElement("a", props, children),
    matchesCardSearch: () => true,
    compareBannerCards: () => 0,
    FEATURED_CARD_LIMIT: 5,
    PROFILE_IMAGE_MAX_BYTES: 4194304
  });
  return renderToStaticMarkup(
    React.createElement(Editor, {
      mode: "profile",
      profile: {
        id: "owner",
        pseudo: "Collector",
        bio: "",
        avatarUrl: null,
        bannerCard: null,
        featuredCards: []
      },
      collection: [],
      initialBannerUrl: existingBanner,
      initialBannerFrame: null,
      framingAvailable: true,
      adapter: {},
      onSaved() {},
      onClose() {}
    })
  );
}

test("Basic sees disabled banner upload, Pro explanations and an available fixed-photo picker", () => {
  const basic = renderEditor(false, "/existing.gif");
  assert.match(basic, /Custom banners are available to Pro members only\./);
  assert.match(
    basic,
    /Animated profile photos are available to Pro members only\./
  );
  assert.match(basic, /<input[^>]*disabled=""[^>]*aria-label="Upload banner"/);
  assert.match(
    basic,
    /accept="image\/jpeg,image\/png,image\/webp"[^>]*aria-label="Profile photo"/
  );
  assert.match(basic, /aria-describedby="profile-avatar-pro-notice"/);
  assert.match(basic, /aria-describedby="profile-banner-pro-notice"/);
  assert.match(basic, /<button[^>]*disabled=""[^>]*>Adjust banner<\/button>/);
  assert.match(basic, /<button>Save<\/button>/);
  assert.equal((basic.match(/Discover Yokkai Pro/g) ?? []).length, 2);
  const pro = renderEditor(true);
  assert.doesNotMatch(pro, /Pro members only/);
  assert.match(pro, /accept="image\/jpeg,image\/png,image\/webp,image\/gif"/);
  assert.doesNotMatch(
    pro,
    /<input[^>]*disabled=""[^>]*aria-label="Upload banner"/
  );
  assert.match(source("components/community-page.tsx"), /screen === "profile"/);
  assert.match(
    source("components/community-page.tsx"),
    /LocalCardCustomizationBoundary userId=\{user.id\}/
  );
});
