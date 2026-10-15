import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = file =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(
  ts.transpileModule(read("components/profile-banner.tsx"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText,
  { exports, require }
);
const render = props =>
  renderToStaticMarkup(React.createElement(exports.ProfileBanner, props));

test("character banners render intact art over a decorative copy", () => {
  const html = render({ characterImage: "/portrait.webp" });
  assert.match(html, /has-image is-character/);
  assert.equal((html.match(/<img /g) ?? []).length, 2);
  assert.equal((html.match(/src="\/portrait.webp"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.match(html, /class="yk-profile-banner-art"/);
  const root = postcss.parse(read("styles/profile.css"));
  const rules = new Map();
  root.walkRules(rule => rules.set(rule.selector, rule));
  const value = (selector, property) =>
    rules.get(selector)?.nodes.find(node => node.prop === property)?.value;
  const art = ".yk-profile-banner.is-character > .yk-profile-banner-art";
  assert.equal(value(art, "object-fit"), "contain");
  assert.equal(value(art, "object-position"), "center");
  assert.equal(value(art, "filter"), "none");
  assert.equal(value(art, "width"), "100%");
  assert.equal(value(art, "height"), "100%");
  assert.match(
    value(
      ".yk-profile-banner.is-character > .yk-profile-banner-backdrop",
      "filter"
    ),
    /blur\(16px\)/
  );
  assert.equal(value(".yk-profile-banner.has-image::after", "content"), "none");
});

test("uploaded banners take priority without the character treatment", () => {
  const html = render({
    uploadedUrl: "/banner.gif",
    characterImage: "/portrait.webp"
  });
  assert.match(html, /src="\/banner.gif"/);
  assert.equal((html.match(/<img /g) ?? []).length, 1);
  assert.doesNotMatch(html, /is-character|portrait.webp|banner-backdrop/);
  assert.match(
    read("styles/profile.css"),
    /\.yk-profile-identity \.yk-profile-banner img\s*\{[^}]*object-fit: cover;[^}]*object-position: center 28%;/
  );
});

test("empty banners keep the default decoration and no broken image", () => {
  const html = render({});
  assert.doesNotMatch(html, /has-image|is-character|<img|banner-shade/);
});

test("the profile and character picker share the banner renderer", () => {
  const source = read("components/profile.tsx");
  assert.match(
    source,
    /<ProfileBanner\s+uploadedUrl=\{uploadedBannerUrl\}\s+characterImage=\{profile.bannerCard\?\.image\}/
  );
  assert.match(
    source,
    /!bannerUrl && bannerCard &&[\s\S]*?<ProfileBanner characterImage=\{bannerCard.image\}/
  );
});
