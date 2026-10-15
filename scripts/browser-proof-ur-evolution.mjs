import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Only the dev-only preview, whose mutation callbacks are in-memory simulations.
const browser = spawn(
  process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-ur-"))}`,
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
    exceptions = [];
  let id = 0;
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      exceptions.push(message.params.exceptionDetails.text);
    if (
      message.method === "Network.requestWillBeSent" &&
      message.params.request.url.includes("/rpc/")
    )
      requests.push(message.params.request.url);
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      if (message.error) callback.reject(message.error);
      else callback.resolve(message.result);
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
    for (let i = 0; i < 200; i++) {
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
  // Extra isolation: even accidental external requests cannot reach production.
  await send("Network.setBlockedURLs", { urls: ["https://*", "http://api.*"] });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send("Page.navigate", {
    url: "http://localhost:3000/design-system/ur-evolution-preview"
  });
  await until("!!document.querySelector('.yk-collection-card')");
  await delay(1200);
  await evaluate("document.querySelector('.yk-collection-card').click()");
  await until(
    "document.querySelector('dialog[open]')?.textContent.includes('Evolve to UR')"
  );
  await clickText("Evolve to UR");
  await until(
    "document.querySelector('dialog[open]')?.textContent.includes('Confirm UR evolution')"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('dialog[open] .yk-evolution-copy[aria-pressed=true]').length"
    ),
    5
  );
  await clickText("Confirmer l’évolution");
  await until("!!document.querySelector('dialog[open] .yk-rarity-UR')");
  assert.equal(
    await evaluate("!!document.querySelector('dialog[open] .yk-shiny')"),
    false
  );
  assert.equal(
    await evaluate(
      "document.querySelector('dialog[open]').textContent.includes('Evolve to UR')"
    ),
    false
  );
  await mkdir(new URL("../artifacts/ur-evolution/", import.meta.url), {
    recursive: true
  });
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      new URL(`../artifacts/ur-evolution/${name}.png`, import.meta.url),
      Buffer.from(data, "base64")
    );
  };
  await capture("desktop-result");
  await evaluate(
    "document.querySelector('dialog[open] button[aria-label=Close]').click()"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-collection-card .yk-rarity-UR').length"
    ),
    1
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-collection-card .yk-rarity-SSR').length"
    ),
    1
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
  assert.deepEqual(exceptions, []);
  console.log(
    "PASS: 5 selected SSR -> non-shiny UR, remaining SSR preserved, distinct frame, desktop/mobile, zero live RPCs."
  );
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) {
    const id = 999999;
    const diagnostic = new Promise(resolve => {
      const handler = event => {
        const message = JSON.parse(event.data);
        if (message.id === id) {
          socket.removeEventListener("message", handler);
          resolve(message.result?.result?.value);
        }
      };
      socket.addEventListener("message", handler);
    });
    socket.send(
      JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression: "document.body.innerText", returnByValue: true }
      })
    );
    console.error(String(await diagnostic).slice(-3500));
  }
  throw error;
} finally {
  socket?.close();
  browser.kill();
}
