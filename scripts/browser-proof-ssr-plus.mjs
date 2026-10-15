import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const browser = spawn(
  process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-ssr-plus-"))}`,
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
);
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    const timeout = setTimeout(
      () => reject(Error("Chrome startup timed out")),
      15000
    );
    browser.on("error", reject);
    browser.stderr.on("data", data => {
      stderr += data;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
  });
  const origin = new URL(endpoint);
  origin.protocol = "http:";
  origin.pathname = "/json/new";
  origin.search = "?about:blank";
  const target = await (await fetch(origin, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve =>
    socket.addEventListener("open", resolve, { once: true })
  );
  const pending = new Map(),
    requests = [],
    errors = [];
  let id = 0;
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails.text);
    if (
      message.method === "Network.requestWillBeSent" &&
      message.params.request.url.includes("/rpc/")
    )
      requests.push(message.params.request.url);
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      message.error
        ? callback.reject(message.error)
        : callback.resolve(message.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    assert.ok(
      !result.exceptionDetails,
      JSON.stringify(result.exceptionDetails)
    );
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 250; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw Error(`Timed out: ${expression}`);
  };
  const clickText = text =>
    evaluate(
      `Array.from(document.querySelectorAll('dialog[open] button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`
    );
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.setBlockedURLs", { urls: ["https://*", "http://api.*"] });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send("Page.navigate", {
    url: "http://localhost:3000/design-system/ssr-plus-preview"
  });
  await until("!!document.querySelector('.yk-collection-card')");
  await delay(1200);
  assert.equal(
    await evaluate(
      "document.querySelector('.yk-ssr-plus .yk-shiny-badge').textContent"
    ),
    "+"
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.yk-ssr-plus .yk-shiny-badge')).backgroundColor"
    ),
    "rgb(255, 95, 168)"
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.yk-ssr-plus .yk-card-badge')).backgroundColor"
    ),
    "rgb(255, 95, 168)"
  );
  await mkdir(new URL("../artifacts/ssr-plus/", import.meta.url), {
    recursive: true
  });
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      new URL(`../artifacts/ssr-plus/${name}.png`, import.meta.url),
      Buffer.from(data, "base64")
    );
  };
  await capture("design-comparison");
  await evaluate("document.querySelector('.yk-collection-card').click()");
  await until(
    "document.querySelector('dialog[open]')?.textContent.includes('Evolve to SSR+')"
  );
  await clickText("Evolve to SSR+");
  await until(
    "document.querySelector('dialog[open]')?.textContent.includes('Confirm SSR+ evolution')"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('dialog[open] .yk-evolution-copy[aria-pressed=true]').length"
    ),
    5
  );
  await clickText("Confirm SSR+ evolution");
  await until("!!document.querySelector('dialog[open] .yk-ssr-plus')");
  assert.equal(
    await evaluate(
      "!!document.querySelector('dialog[open] .yk-rarity-SSR.yk-shiny.yk-ssr-plus')"
    ),
    true
  );
  assert.equal(
    await evaluate(
      "document.querySelector('dialog[open]').textContent.includes('Evolve to SSR+')"
    ),
    false
  );
  await capture("desktop-result");
  await evaluate(
    "document.querySelector('dialog[open] button[aria-label=Close]').click()"
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.yk-collection-card').length"),
    2
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-collection-card .yk-ssr-plus').length"
    ),
    1
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.yk-rarity-UR').length"),
    0
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await delay(150);
  assert.equal(
    await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
    true
  );
  await capture("mobile-result");
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 5 SSR -> pink SSR+, plus badge, remaining SSR preserved, LR Shiny unchanged, desktop/mobile, zero live RPCs."
  );
} finally {
  socket?.close();
  browser.kill();
}
