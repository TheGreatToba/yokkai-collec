import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getImgProps } = require("next/dist/shared/lib/get-img-props");
const { imageConfigDefault } = require("next/dist/shared/lib/image-config");
const defaultLoader = require("next/dist/shared/lib/image-loader").default;

const origin = "https://images.example.test";
const catalogue = `${origin}/storage/v1/object/public/card-images/card-a`;
function load(path, env = { NEXT_PUBLIC_SUPABASE_URL: origin }) {
  const exports = {};
  const OptimizedImage = props =>
    React.createElement("img", { ...props, "data-optimized": "true" });
  const source = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true
      }
    }
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    URL,
    process: { env },
    require: name => {
      if (name.endsWith(".css")) return {};
      if (name === "next/image") return OptimizedImage;
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsxRuntime;
      assert.fail(name);
    }
  });
  return exports;
}

test("only configured public catalogue images use the optimizer; original sources stay usable", () => {
  const { YokaiCard } = load("../components/yokai-card.tsx");
  const card = {
    name: "Card",
    category: "Test",
    rarity: "SR",
    animated: false
  };
  const render = image =>
    renderToStaticMarkup(
      React.createElement(YokaiCard, {
        ...card,
        image,
        imageSizes: "100vw"
      })
    );
  assert.match(render(catalogue), /data-optimized="true"/);
  assert.match(render(catalogue), /sizes=/);
  for (const image of [
    "/assets/booster-pack.png",
    "https://i.imgur.com/card.png",
    `${origin}/storage/v1/object/public/avatars/photo`,
    `${origin}/storage/v1/object/public/card-images-evil/card`,
    `${catalogue}?token=private`,
    `${catalogue}#fragment`,
    catalogue.replace("https:", "http:"),
    catalogue.replace("images.example.test", "images.example.test.evil"),
    catalogue.replace(
      "images.example.test",
      "user:password@images.example.test"
    ),
    "not a URL"
  ]) {
    const html = render(image);
    assert.doesNotMatch(html, /data-optimized/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
  }
  assert.doesNotMatch(
    renderToStaticMarkup(
      React.createElement(load("../components/yokai-card.tsx", {}).YokaiCard, {
        ...card,
        image: catalogue
      })
    ),
    /data-optimized/
  );
});

test("optimizer failure clears srcset and falls back to the original catalogue illustration", () => {
  const { YokaiCard } = load("../components/yokai-card.tsx");
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
      image: catalogue,
      imageSizes: "100vw"
    })
  );
  const target = {
    src: "https://front.test/_next/image?url=card",
    srcset: "optimized 2x",
    removeAttribute(name) {
      if (name === "srcset") this.srcset = "";
    }
  };
  art.props.onError({ currentTarget: target });
  assert.equal(target.src, catalogue);
  assert.equal(target.srcset, "");
});

test("only grids resize images at quality 85; details and reveals keep the original", () => {
  const { YokaiCard } = load("../components/yokai-card.tsx");
  const card = {
    name: "Card",
    category: "Test",
    rarity: "C",
    image: catalogue
  };
  const original = renderToStaticMarkup(React.createElement(YokaiCard, card));
  assert.doesNotMatch(original, /data-optimized|srcSet=|sizes=/);
  assert.match(original, /loading="lazy"/);
  assert.match(original, /decoding="async"/);
  const grid = renderToStaticMarkup(
    React.createElement(YokaiCard, { ...card, imageSizes: "100vw" })
  );
  assert.match(grid, /data-optimized="true"/);
  assert.match(grid, /quality="85"/);
  assert.match(grid, /sizes="100vw"/);
  assert.ok(load("../next.config.ts").default.images.qualities.includes(85));
  const { props } = getImgProps(
    {
      src: catalogue,
      width: 300,
      height: 420,
      sizes: "100vw",
      quality: 85,
      loading: "lazy"
    },
    {
      imgConf: {
        ...imageConfigDefault,
        ...load("../next.config.ts").default.images
      },
      defaultLoader
    }
  );
  const candidates = props.srcSet.split(", ").map(entry => {
    const [url, descriptor] = entry.split(" ");
    assert.equal(
      new URL(url, "https://front.test").searchParams.get("q"),
      "85"
    );
    return Number(descriptor.slice(0, -1));
  });
  for (const viewport of [320, 390, 430, 640]) {
    for (const density of [1, 2, 3]) {
      const delivered = candidates.find(width => width >= viewport * density);
      assert.ok(delivered >= viewport * density);
    }
  }
});

test("remotePatterns restrict HTTPS, exact origin and public card-images bucket without redirects", () => {
  const config = load("../next.config.ts").default;
  assert.equal(config.images?.remotePatterns?.length, 1);
  const pattern = config.images.remotePatterns[0];
  assert.equal(pattern.hostname, "images.example.test");
  assert.equal(pattern.pathname, "/storage/v1/object/public/card-images/**");
  assert.equal(pattern.search, "");
  assert.equal(config.images.maximumRedirects, 0);
  assert.notEqual(config.images.dangerouslyAllowLocalIP, true);
});
