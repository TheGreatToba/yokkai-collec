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
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-native-drop-"))}`,
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
  const mediaRequests = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (
      message.method === "Network.requestWillBeSent" &&
      /\\.(mp4|webm)(?:[?#]|$)/i.test(message.params.request.url)
    )
      mediaRequests.push(message.params.request.url);
  });
  await send("Network.setBlockedURLs", { urls: ["https://*", "http://api.*"] });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send("Page.navigate", { url: "http://localhost:3000/boosters" });
  await until("!!document.querySelector('button[aria-pressed]')");
  await delay(1200);
  await mkdir(new URL("../artifacts/native-drop/", import.meta.url), {
    recursive: true
  });
  for (const variant of ["before", "after"]) {
    await evaluate(
      `Array.from(document.querySelectorAll('button[aria-pressed]')).find(b=>b.textContent.startsWith('${variant === "before" ? "Before" : "After"}')).click()`
    );
    await until(
      `document.documentElement.getAttribute('data-drop-animation')==='${variant}'`
    );
    await evaluate(
      "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Ouvrir' && !b.disabled).click()"
    );
    await until("!!document.querySelector('.yk-deck-button')");
    for (const [index, rarity, name] of [
      [0, "SSR", "Levi Ackerman"],
      [1, "LR", "Monkey D. Luffy"]
    ]) {
      await evaluate("document.querySelector('.yk-deck-button').click()");
      await until(
        `!!document.querySelector('.yk-reveal-${rarity.toLowerCase()} .yk-card')`
      );
      await delay(rarity === "SSR" ? 2200 : 3300);
      const info = await evaluate(
        `(()=>{const s=document.querySelector('.yk-reveal-${rarity.toLowerCase()}');return {name:s.querySelector('.yk-card-name').textContent,animation:getComputedStyle(s.querySelector('.yk-flip')).animationName};})()`
      );
      assert.equal(info.name, name);
      assert.equal(
        info.animation,
        variant === "after" ? `yk-native-${rarity.toLowerCase()}-flip` : "none"
      );
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(
        new URL(
          `../artifacts/native-drop/${variant}-${rarity.toLowerCase()}.png`,
          import.meta.url
        ),
        Buffer.from(data, "base64")
      );
      if (rarity === "LR") {
        await until("!!document.querySelector('dialog[open]')");
        await evaluate(
          "document.querySelector('dialog[open] button[aria-label=Close]').click()"
        );
      }
      await until(
        `document.querySelectorAll('.yk-reveal-slot.yk-filled').length===${index + 1}`
      );
    }
    await until("!!document.querySelector('.yk-reveal-summary')");
    await evaluate(
      "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Retour aux boosters').click()"
    );
  }
  assert.equal(await evaluate("document.querySelectorAll('video').length"), 0);
  assert.deepEqual(requests, []);
  assert.deepEqual(mediaRequests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: /boosters Before/After, same SSR + LR, real pack opening, native CSS only, no game RPC."
  );
} finally {
  socket?.close();
  browser.kill();
}
