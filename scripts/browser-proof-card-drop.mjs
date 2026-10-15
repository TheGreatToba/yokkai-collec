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
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-drops-"))}`,
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
    url: "http://localhost:3000/design-system/card-drop-preview"
  });
  await until("!!document.querySelector('.yk-deck-button')");
  await delay(1200);
  await mkdir(new URL("../artifacts/drop-videos/", import.meta.url), {
    recursive: true
  });
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      new URL(`../artifacts/drop-videos/${name}.png`, import.meta.url),
      Buffer.from(data, "base64")
    );
  };
  const choose = async rarity => {
    await evaluate(
      `Array.from(document.querySelectorAll('main > div button')).find(b=>b.textContent.trim()===${JSON.stringify(rarity)})?.click()`
    );
    await delay(120);
    await evaluate("document.querySelector('.yk-deck-button').click()");
  };
  for (const rarity of ["SR", "SSR", "LR"]) {
    await choose(rarity);
    await until("!!document.querySelector('dialog[open] video')?.currentSrc");
    await until(
      "document.querySelector('dialog[open] video')?.readyState >= 2"
    );
    const info = await evaluate(
      `(()=>{const v=document.querySelector('dialog[open] video');const c=getComputedStyle(v);return {src:v.currentSrc,muted:v.muted,inline:v.playsInline,mask:c.maskComposite,size:c.maskSize,width:v.videoWidth,height:v.videoHeight};})()`
    );
    assert.ok(info.src.endsWith(`/${rarity.toLowerCase()}-v1.mp4`));
    assert.equal(info.muted, true);
    assert.equal(info.inline, true);
    assert.ok(info.mask.split(",").every(value => value.trim() === "exclude"));
    assert.ok(info.size.includes("32% 84%"));
    assert.equal(info.width, 1280);
    assert.equal(info.height, 720);
    await evaluate(
      `(()=>{const v=document.querySelector('dialog[open] video');v.currentTime=${rarity === "LR" ? 8 : 5};})()`
    );
    await until(
      "!!document.querySelector('dialog[open] .yk-drop-real-card .yk-card')"
    );
    assert.ok(
      await evaluate(
        "document.querySelector('dialog[open] .yk-card-name').textContent.includes('Actual drawn card')"
      )
    );
    await capture(`${rarity.toLowerCase()}-desktop`);
    await clickText("Skip animation");
    await until("!document.querySelector('dialog[open] video')");
    if (rarity === "LR") {
      await until("!!document.querySelector('dialog[open] .yk-rarity-LR')");
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
  await until("document.querySelector('dialog[open] video')?.readyState >= 2");
  await evaluate("document.querySelector('dialog[open] video').currentTime=5");
  await until(
    "!!document.querySelector('dialog[open] .yk-drop-real-card .yk-card')"
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
    true
  );
  await capture("ssr-mobile");
  await clickText("Skip animation");
  await until("!document.querySelector('dialog[open] video')");
  // Error and ended events must both unblock without duplicating reveals.
  await choose("SR");
  await until("!!document.querySelector('dialog[open] video')?.currentSrc");
  await evaluate(
    "document.querySelector('dialog[open] video').dispatchEvent(new Event('error'))"
  );
  await until("!document.querySelector('dialog[open] video')");
  await choose("SR");
  await until("!!document.querySelector('dialog[open] video')?.currentSrc");
  await evaluate(
    "document.querySelector('dialog[open] video').dispatchEvent(new Event('ended'))"
  );
  await until("!document.querySelector('dialog[open] video')");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
  await choose("SSR");
  await until("!!document.querySelector('.yk-deck-button.yk-face-up')");
  assert.equal(
    await evaluate("!!document.querySelector('dialog[open] video')"),
    false
  );
  await choose("C");
  await until("!!document.querySelector('.yk-deck-button.yk-face-up')");
  assert.equal(
    await evaluate("!!document.querySelector('dialog[open] video')"),
    false
  );
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: SR/SSR/LR native video playback, permanent mask + real card, skip/end/error, mobile, reduced motion, C unchanged, zero game RPCs."
  );
} finally {
  socket?.close();
  browser.kill();
}
