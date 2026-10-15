import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../lib/ui/banner-frame.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  { exports }
);
const { bannerGeometry, normalizeBannerFrame, panBanner, BANNER_ASPECT } =
  exports;
const center = { x: 50, y: 50, zoom: 1 };

test("banner framing fits every image ratio without changing its proportions", () => {
  for (const aspect of [0.2, 0.66, 1, 2.3, 4, 10]) {
    const initial = bannerGeometry(aspect, center);
    assert.ok(initial.minZoom > 0 && initial.minZoom <= 1);
    const full = bannerGeometry(aspect, { ...center, zoom: initial.minZoom });
    assert.ok(Math.abs(full.scale - 1) < 1e-10);
    assert.ok(full.overflowX < 1e-10 && full.overflowY < 1e-10);
    assert.equal(full.offsetX, 0);
    assert.equal(full.offsetY, 0);
  }
  assert.equal(bannerGeometry(BANNER_ASPECT, center).scale, 1);
});

test("dragging is bounded, independent of viewport size and keeps the image inside its possible crop", () => {
  for (const aspect of [0.66, 1, 4]) {
    const moved = panBanner(center, aspect, 0.1, -0.2);
    const geometry = bannerGeometry(aspect, moved);
    assert.ok(moved.x >= 0 && moved.x <= 100 && moved.y >= 0 && moved.y <= 100);
    assert.ok(Math.abs(geometry.offsetX) <= 50 * geometry.overflowX);
    assert.ok(Math.abs(geometry.offsetY) <= 50 * geometry.overflowY);
    const edge = panBanner(center, aspect, 1000, -1000);
    assert.ok(edge.x === 0 || edge.x === 50);
    assert.ok(edge.y === 100 || edge.y === 50);
  }
  const full = bannerGeometry(0.66, center);
  const fit = { ...center, zoom: full.minZoom };
  assert.equal(panBanner(fit, 0.66, 20, 20).x, 50);
  assert.equal(panBanner(fit, 0.66, 20, 20).y, 50);
});

test("invalid client metadata cannot generate NaN or unbounded transforms", () => {
  for (const frame of [
    { x: NaN, y: Infinity, zoom: NaN },
    { x: -999, y: 999, zoom: 999 }
  ]) {
    const safe = normalizeBannerFrame(frame);
    assert.ok(safe.x >= 0 && safe.x <= 100 && safe.y >= 0 && safe.y <= 100);
    assert.ok(safe.zoom >= 0.01 && safe.zoom <= 4);
    for (const value of Object.values(bannerGeometry(NaN, safe)))
      assert.ok(Number.isFinite(value));
  }
});
