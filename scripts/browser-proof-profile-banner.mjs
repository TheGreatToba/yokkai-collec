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
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-profile-banner-"))}`,
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
  const run = fn => evaluate("(" + fn.toString() + ")()");
  await send("Page.navigate", {
    url: "http://localhost:3000/design-system/profile-preview?catalogue=demo"
  });
  await until(
    "document.querySelector('.yk-profile-banner-art')?.naturalHeight > 0"
  );
  const artifacts = new URL(
    "../artifacts/profile-banner-fit/",
    import.meta.url
  );
  await mkdir(artifacts, { recursive: true });
  const screenshot = async name => {
    await evaluate("scrollTo(0,0)");
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL(name, artifacts), Buffer.from(data, "base64"));
  };
  for (const width of [1920, 3840, 1024, 768, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 3840 ? 1968 : 1080,
      deviceScaleFactor: 1,
      mobile: width < 700
    });
    for (const shape of ["portrait", "landscape", "square"]) {
      await evaluate("window.bannerTestShape=" + JSON.stringify(shape));
      await run(async () => {
        const b = document.querySelector(
          ".yk-profile-identity .yk-profile-banner"
        );
        const art = b.querySelector(".yk-profile-banner-art");
        const shape = window.bannerTestShape;
        if (shape !== "portrait") {
          const canvas = document.createElement("canvas");
          canvas.width = shape === "landscape" ? 800 : 400;
          canvas.height = 400;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#9b7cc8";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = "#efd268";
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
          art.src = canvas.toDataURL();
        } else art.src = "/assets/landing/gojou.webp";
        b.querySelector(".yk-profile-banner-backdrop").src = art.src;
        await art.decode();
      });
      const result = await run(() => {
        const b = document.querySelector(
          ".yk-profile-identity .yk-profile-banner"
        );
        const art = b.querySelector(".yk-profile-banner-art");
        const style = getComputedStyle(art),
          rect = art.getBoundingClientRect();
        const ratio = Math.min(
          rect.width / art.naturalWidth,
          rect.height / art.naturalHeight
        );
        return {
          fit: style.objectFit,
          position: style.objectPosition,
          filter: style.filter,
          widthFits: art.naturalWidth * ratio <= b.clientWidth + 1,
          heightFits: art.naturalHeight * ratio <= b.clientHeight + 1,
          stripe: getComputedStyle(b, "::after").content,
          blur: getComputedStyle(b.querySelector(".yk-profile-banner-backdrop"))
            .filter,
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      assert.equal(result.fit, "contain");
      assert.equal(result.position, "50% 50%");
      assert.equal(result.filter, "none");
      assert.ok(result.widthFits && result.heightFits, JSON.stringify(result));
      assert.equal(result.stripe, "none");
      assert.match(result.blur, /blur\(16px\)/);
      assert.equal(result.overflow, false);
      if (shape === "portrait") await screenshot("character-" + width + ".png");
    }
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false
  });
  const edit = () =>
    run(() =>
      Array.from(document.querySelectorAll("button"))
        .find(b => b.textContent.trim() === "Modifier le profil")
        .click()
    );
  await edit();
  await until("!!document.querySelector('.yk-profile-banner-editor-preview')");
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.yk-profile-banner-editor-preview .yk-profile-banner-art')).objectFit"
    ),
    "contain"
  );
  await run(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#a87dc1";
    ctx.fillRect(0, 0, 1000, 400);
    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/png")
    );
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "banner.png", { type: "image/png" }));
    const input = document.querySelector(
      'input[aria-label="Importer une bannière"]'
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await until(
    "document.querySelector('.yk-profile-banner-preview')?.src.startsWith('blob:')"
  );
  await clickText("Enregistrer");
  await until("!document.querySelector('.yk-profile-banner-editor')");
  const uploaded = await run(() => {
    const b = document.querySelector(".yk-profile-identity .yk-profile-banner");
    return {
      images: b.querySelectorAll("img").length,
      character: b.classList.contains("is-character"),
      fit: getComputedStyle(b.querySelector("img")).objectFit,
      position: getComputedStyle(b.querySelector("img")).objectPosition,
      src: b.querySelector("img").src
    };
  });
  assert.equal(uploaded.images, 1);
  assert.equal(uploaded.character, false);
  assert.equal(uploaded.fit, "cover");
  assert.equal(uploaded.position, "50% 28%");
  assert.ok(uploaded.src.startsWith("blob:"));
  await screenshot("uploaded-desktop.png");
  await edit();
  await until("!!document.querySelector('.yk-profile-banner-preview')");
  await clickText("Retirer la bannière");
  await clickText("Enregistrer");
  await until("!document.querySelector('.yk-profile-banner-editor')");
  assert.equal(
    await evaluate(
      "document.querySelector('.yk-profile-identity .yk-profile-banner').querySelectorAll('img').length"
    ),
    0
  );
  await screenshot("empty-desktop.png");
  assert.ok(
    requests.every(url => url.endsWith("/get_profile")),
    JSON.stringify(requests)
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: portrait, landscape and square card art fits at 390/768/1024/1920/3840px; picker preview; uploaded crop unchanged; empty banner; no data writes."
  );
} finally {
  socket?.close();
  browser.kill();
}
