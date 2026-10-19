import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin =
  process.env.PRIVATE_MESSAGES_PREVIEW_ORIGIN ?? "http://localhost:3002";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
  "Local browser proof only"
);
const browser = spawn(
  process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-private-messages-"))}`,
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
);
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(
      () => reject(Error("Chrome startup timed out")),
      15000
    );
    browser.on("error", reject);
    browser.stderr.on("data", data => {
      log += data;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  const targetUrl = new URL(endpoint);
  targetUrl.protocol = "http:";
  targetUrl.pathname = "/json/new";
  targetUrl.search = "?about:blank";
  const target = await (await fetch(targetUrl, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve =>
    socket.addEventListener("open", resolve, { once: true })
  );
  let id = 0;
  const pending = new Map();
  const rpcRequests = [];
  const errors = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails.text);
    if (
      message.method === "Network.requestWillBeSent" &&
      message.params.request.url.includes("/rest/v1/rpc/")
    )
      rpcRequests.push(message.params.request.url);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      if (message.error) request.reject(message.error);
      else request.resolve(message.result);
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
  const run = fn => evaluate(`(${fn.toString()})()`);
  const until = async expression => {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    const diagnostic = await evaluate(
      "({text:document.body.innerText,draft:document.querySelector('dialog[open] textarea')?.value,stored:localStorage.getItem('yokkai:private-messages-preview:v1')})"
    );
    throw Error(`Timed out: ${expression} ${JSON.stringify(diagnostic)}`);
  };
  const click = selector =>
    evaluate(
      `(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.focus(); element.click(); })()`
    );
  const type = async text => {
    await evaluate("document.querySelector('dialog[open] textarea').focus()");
    await send("Input.insertText", { text });
    await until(
      "!document.querySelector('dialog[open] button[type=submit]').disabled"
    );
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["https://*"] });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send("Page.navigate", {
    url: origin + "/design-system/private-messages-preview"
  });
  await until("!!document.querySelector('[aria-label=\"Message Kitsune\"]')");
  await click('[aria-label="Message Kitsune"]');
  await until(
    "!!document.querySelector('dialog[open] textarea:not(:disabled)')"
  );
  assert.ok(
    await run(() =>
      document
        .querySelector("dialog[open]")
        .textContent.includes("Start a conversation")
    )
  );
  await type("Hello Kitsune <script>alert(1)</script> 👋");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  });
  await until(
    "document.querySelectorAll('.yk-private-message.is-own').length === 1"
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.yk-private-message p').textContent"
    ),
    "Hello Kitsune <script>alert(1)</script> 👋"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-private-message script').length"
    ),
    0
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });
  await until("!document.querySelector('dialog[open]')");
  assert.equal(
    await evaluate("document.activeElement.getAttribute('aria-label')"),
    "Message Kitsune"
  );
  await run(() => {
    const select = document.querySelector('[aria-label="Preview player"]');
    select.value = "preview-kitsune";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await until("!!document.querySelector('[aria-label=\"Message BBDOU\"]')");
  await click('[aria-label="Message BBDOU"]');
  await until("document.querySelectorAll('.yk-private-message').length === 1");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-private-message.is-own').length"
    ),
    0
  );
  await type("Hello BBDOU!\nLet's trade tomorrow.");
  await click('dialog[open] button[type="submit"]');
  await until("document.querySelectorAll('.yk-private-message').length === 2");
  await click('dialog[open] button[aria-label="Close"]');
  await run(() => {
    const select = document.querySelector('[aria-label="Preview player"]');
    select.value = "preview-bbdou";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await until("!!document.querySelector('[aria-label=\"Message Kitsune\"]')");
  await run(() =>
    document
      .querySelector(
        '.yk-private-messages-preview-tools input[type="checkbox"]'
      )
      .click()
  );
  await click('[aria-label="Message Kitsune"]');
  await until("document.querySelectorAll('.yk-private-message').length === 2");
  await type("Keep my draft on failure");
  await click('dialog[open] button[type="submit"]');
  await until("!!document.querySelector('dialog[open] [role=alert]')");
  assert.equal(
    await evaluate("document.querySelector('dialog[open] textarea').value"),
    "Keep my draft on failure"
  );
  await click('dialog[open] button[type="submit"]');
  await until("document.querySelectorAll('.yk-private-message').length === 3");
  await run(() => {
    const key = "yokkai:private-messages-preview:v1";
    const messages = JSON.parse(localStorage.getItem(key));
    messages.push({
      id: crypto.randomUUID(),
      senderId: "preview-kitsune",
      recipientId: "preview-bbdou",
      text: "This reply arrived while the conversation stayed open.",
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(messages));
  });
  await until("document.querySelectorAll('.yk-private-message').length === 4");
  const screenshots = new URL(
    "../artifacts/private-messages/",
    import.meta.url
  );
  await mkdir(screenshots, { recursive: true });
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL(name, screenshots), Buffer.from(data, "base64"));
  };
  await capture("desktop.png");
  await click('dialog[open] button[aria-label="Close"]');
  await run(() =>
    Array.from(document.querySelectorAll("button"))
      .find(button => button.textContent === "Add sample conversation")
      .click()
  );
  await until("!!document.querySelector('[aria-label=\"Message Kitsune\"]')");
  await click('[aria-label="Message Kitsune"]');
  await until("document.querySelectorAll('.yk-private-message').length === 40");
  await run(() =>
    Array.from(document.querySelectorAll("dialog[open] button"))
      .find(button => button.textContent === "Load older messages")
      .click()
  );
  await until("document.querySelectorAll('.yk-private-message').length === 59");
  assert.equal(
    await evaluate(
      "Array.from(document.querySelectorAll('dialog[open] button')).some(button => button.textContent === 'Load older messages')"
    ),
    false
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  const bounds = await run(() => {
    const dialog = document
      .querySelector("dialog[open]")
      .getBoundingClientRect();
    const compose = document
      .querySelector("dialog[open] textarea")
      .getBoundingClientRect();
    return {
      left: dialog.left,
      right: dialog.right,
      bottom: compose.bottom,
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  assert.ok(
    bounds.left >= 0 &&
      bounds.right <= bounds.width &&
      bounds.bottom < bounds.height &&
      !bounds.overflow,
    JSON.stringify(bounds)
  );
  await capture("mobile.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 500,
    deviceScaleFactor: 1,
    mobile: true
  });
  assert.ok(
    await run(() => {
      const submit = document
        .querySelector('dialog[open] button[type="submit"]')
        .getBoundingClientRect();
      const log = document
        .querySelector(".yk-private-messages-log")
        .getBoundingClientRect();
      return (
        submit.bottom <= innerHeight &&
        log.height >= 60 &&
        document.documentElement.scrollWidth <= innerWidth
      );
    }),
    "Composer and send button must stay reachable in a short mobile viewport"
  );
  await capture("mobile-short.png");
  await click('dialog[open] button[aria-label="Close"]');
  assert.equal(
    await evaluate(
      "localStorage.getItem('yokkai:private-messages-preview:v1') !== null"
    ),
    true
  );
  assert.deepEqual(errors, []);
  assert.ok(
    rpcRequests.every(
      url =>
        new URL(url).hostname === "127.0.0.1" &&
        new URL(url).pathname === "/rest/v1/rpc/get_profile"
    ),
    "Only the existing navigation's read-only local profile lookup is allowed; no messaging RPC or other mutation"
  );
  console.log(
    "Private messages browser proof passed: friends buttons, send/reply, literal text, failed-send draft, retry, pagination, mobile bounds, Escape/focus and zero live messaging RPCs."
  );
} finally {
  socket?.close();
  browser.kill();
}
