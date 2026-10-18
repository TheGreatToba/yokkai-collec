// Regenerate: node scripts/og-image/render.mjs (installed Playwright and Chromium; NODE_PATH can point to the bundled runtime).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const load = createRequire(import.meta.url);
const { chromium } = load("playwright");
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
(async () => {
  const executablePath =
    process.env.CHROMIUM_PATH ||
    [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    ].find(existsSync);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-lcd-text"]
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1
    });
    await page.goto(pathToFileURL(resolve(sourceDirectory, "index.html")).href);
    await page.evaluate(() => document.fonts.ready);
    assert(
      await page
        .locator("img")
        .evaluate(img => img.complete && img.naturalWidth === 1672)
    );
    for (const selector of ["h1", "p", "footer"]) {
      const box = await page.locator(selector).evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
      });
      assert(
        box.left >= 60 &&
          box.right <= 1140 &&
          box.top >= 60 &&
          box.bottom <= 590,
        `${selector} outside safe area`
      );
    }
    const output = resolve(sourceDirectory, "../../public/og-home.png");
    await page.screenshot({ path: output });
    const png = readFileSync(output);
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert(png.length < 300 * 1024, "PNG exceeds 300 KiB");
    console.log(`1200 x 630 PNG: ${png.length} bytes`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
