import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const catalogue =
  "https://images.example.test/storage/v1/object/public/card-images/card-a";
function load() {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../components/yokai-card.tsx", import.meta.url),
        "utf8"
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true
        }
      }
    ).outputText,
    {
      exports,
      URL,
      process: {
        env: { NEXT_PUBLIC_SUPABASE_URL: "https://images.example.test" }
      },
      require: name => {
        if (name.endsWith(".css")) return {};
        if (name === "react") return React;
        if (name === "react/jsx-runtime") return jsxRuntime;
        if (name === "next/image")
          return props =>
            React.createElement("img", { ...props, "data-optimized": "true" });
        assert.fail(name);
      }
    }
  );
  return exports.YokaiCard;
}

test("all grid sources and rarities load exactly the detail original, without resizing or recompression", () => {
  const YokaiCard = load();
  for (const image of [
    catalogue,
    "https://s4.anilist.co/file/anilistcdn/character/large/card.png",
    "https://i.imgur.com/card.png",
    "https://media.giphy.com/media/card/giphy.gif",
    "https://other.example.test/art.jpg",
    "/assets/booster-pack.png",
    `${catalogue}?token=private`
  ]) {
    for (const rarity of ["C", "R", "SR", "SSR", "LR"]) {
      const props = {
        name: "Card",
        category: "Test",
        rarity,
        image,
        animated: false
      };
      const detail = renderToStaticMarkup(
        React.createElement(YokaiCard, props)
      );
      for (const imageSizes of ["100vw", "(max-width: 640px) 45vw, 200px"]) {
        const grid = renderToStaticMarkup(
          React.createElement(YokaiCard, { ...props, imageSizes })
        );
        assert.equal(grid, detail, `${rarity} ${image}`);
        assert.doesNotMatch(
          grid,
          /_next\/image|data-optimized|srcSet=|sizes=|quality=/
        );
        assert.match(grid, /loading="lazy"/);
        assert.match(grid, /decoding="async"/);
        assert.ok(grid.includes(`src="${image}"`));
      }
    }
  }
});

test("personal image failure falls back to the native catalogue source and never loops", () => {
  const YokaiCard = load();
  let art;
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.props.onError) art = node;
    React.Children.forEach(node.props.children, visit);
  }
  visit(
    YokaiCard({
      name: "Card",
      category: "Test",
      rarity: "SR",
      image: "https://i.imgur.com/custom.png",
      catalogueImage: catalogue,
      imageSizes: "100vw"
    })
  );
  let replacements = 0;
  const target = {
    src: "https://i.imgur.com/custom.png",
    removeAttribute: () => {},
    set src(value) {
      this.current = value;
      replacements++;
    },
    get src() {
      return this.current;
    }
  };
  target.current = "https://i.imgur.com/custom.png";
  art.props.onError({ currentTarget: target });
  assert.equal(target.src, catalogue);
  art.props.onError({ currentTarget: target });
  assert.equal(replacements, 1);
});

test("optimizer remains restricted for other callers: exact public Storage origin, HTTPS, no redirects", () => {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../next.config.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }
    ).outputText,
    {
      exports,
      URL,
      process: {
        env: { NEXT_PUBLIC_SUPABASE_URL: "https://images.example.test" }
      }
    }
  );
  const images = exports.default.images;
  assert.equal(images.remotePatterns.length, 1);
  assert.equal(images.remotePatterns[0].hostname, "images.example.test");
  assert.equal(
    images.remotePatterns[0].pathname,
    "/storage/v1/object/public/card-images/**"
  );
  assert.equal(images.remotePatterns[0].search, "");
  assert.equal(images.maximumRedirects, 0);
  assert.notEqual(images.dangerouslyAllowLocalIP, true);
});
