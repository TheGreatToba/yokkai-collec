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
  await send("Page.navigate", {
    url: "http://localhost:3000/design-system/card-drop-preview"
  });
  await until("!!document.querySelector('.yk-deck-button')");
  await delay(1200);
  await mkdir(new URL("../artifacts/native-drop/", import.meta.url), {
    recursive: true
  });
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      new URL(`../artifacts/native-drop/${name}.png`, import.meta.url),
      Buffer.from(data, "base64")
    );
  };
  const choose = async rarity => {
    await evaluate(
      `Array.from(document.querySelectorAll('main > div button')).find(b=>b.textContent.trim()===${JSON.stringify(rarity)})?.click()`
    );
    await delay(100);
    await evaluate("document.querySelector('.yk-deck-button').click()");
  };
  for (const rarity of ["SR", "SSR", "LR"]) {
    await choose(rarity);
    await until(
      `!!document.querySelector('.yk-reveal-${rarity.toLowerCase()} .yk-card')`
    );
    await delay(rarity === "SR" ? 700 : rarity === "SSR" ? 2250 : 3300);
    const info = await evaluate(
      `(()=>{const stage=document.querySelector('.yk-reveal-${rarity.toLowerCase()}');const flip=stage.querySelector('.yk-flip');return {name:stage.querySelector('.yk-card-name').textContent,image:stage.querySelector('.yk-card-art img').getAttribute('src'),animation:getComputedStyle(flip).animationName,running:stage.getAnimations({subtree:true}).length};})()`
    );
    assert.equal(info.name, "Satoru Gojo");
    assert.equal(info.image, "/assets/landing/gojou.webp");
    assert.ok(info.running > 0);
    if (rarity !== "SR")
      assert.equal(info.animation, `yk-native-${rarity.toLowerCase()}-flip`);
    assert.equal(
      await evaluate("document.querySelectorAll('video').length"),
      0
    );
    await capture(`${rarity.toLowerCase()}-desktop`);
    await until(
      "!!document.querySelector('.yk-reveal-summary') || !!document.querySelector('dialog[open]')"
    );
    if (rarity === "LR") {
      await until("!!document.querySelector('dialog[open]')");
      await evaluate(
        "document.querySelector('dialog[open] button[aria-label=Close]').click()"
      );
    }
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await choose("SSR");
  await delay(2200);
  assert.equal(
    await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
    true
  );
  await capture("ssr-mobile");
  await until("!!document.querySelector('.yk-reveal-summary')");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
  await choose("SSR");
  await delay(100);
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.yk-reveal-ssr .yk-flip')).animationName"
    ),
    "none"
  );
  assert.equal(await evaluate("document.querySelectorAll('video').length"), 0);
  assert.deepEqual(mediaRequests, []);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native SR violet / SSR pink / LR gold, actual Gojo artwork, real 3D flip, mobile, reduced motion, no video/media/RPC."
  );
} finally {
  socket?.close();
  browser.kill();
}
