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
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-callouts-"))}`,
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
);
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(
      () => reject(Error("Chrome startup timed out")),
      15000
    );
    browser.on("error", reject);
    browser.stderr.on("data", data => {
      stderr += data;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
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
    if (
      message.method === "Runtime.consoleAPICalled" &&
      ["warning", "error"].includes(message.params.type)
    ) {
      errors.push(
        message.params.args.map(arg => arg.value ?? arg.description).join(" ")
      );
    }
    if (
      message.method === "Log.entryAdded" &&
      ["warning", "error"].includes(message.params.entry.level)
    ) {
      errors.push(
        message.params.entry.text + " " + (message.params.entry.url ?? "")
      );
      console.log("log error", errors.at(-1));
    }
    if (message.method === "Fetch.requestPaused") {
      // The local preview has no signed-in account. Model the unrelated Pro status as inactive.
      socket.send(
        JSON.stringify({
          id: ++id,
          method: "Fetch.fulfillRequest",
          params: {
            requestId: message.params.requestId,
            responseCode: 200,
            responseHeaders: [
              { name: "Content-Type", value: "application/json" }
            ],
            body: Buffer.from('{"active":false}').toString("base64")
          }
        })
      );
    }
    if (message.method === "Runtime.exceptionThrown") {
      const detail = message.params.exceptionDetails;
      errors.push(detail.exception?.description ?? detail.text);
      console.log("browser error", errors.at(-1));
    }
    if (message.method === "Target.attachedToTarget") {
      socket.send(
        JSON.stringify({
          id: ++id,
          method: "Runtime.enable",
          sessionId: message.params.sessionId
        })
      );
    }
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
    for (let i = 0; i < 2400; i++) {
      if (await evaluate(expression)) return;
      await delay(25);
    }
    throw Error(
      `Timed out: ${expression}; ${await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(0,1200)})")}`
    );
  };
  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true
  });
  await send("Fetch.enable", {
    patterns: [
      {
        urlPattern: "http://localhost:3108/api/pro/benefits",
        requestStage: "Request"
      }
    ]
  });
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
  const viewport = async (width, scale = 1) => {
    await send("Emulation.setDeviceMetricsOverride", {
      width: Math.round(width / scale),
      height: Math.round(900 / scale),
      deviceScaleFactor: scale,
      mobile: width < 700
    });
    await evaluate(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))"
    );
  };
  const report = [];
  await mkdir(new URL("../artifacts/single-animation/", import.meta.url), {
    recursive: true
  });
  for (let pack = 0; pack < 6; pack++) {
    console.log("starting pack", pack + 1);
    await viewport(375);
    if (pack === 0) {
      await send("Page.navigate", {
        url: "http://localhost:3108/design-system/booster-opening-preview"
      });
      await until(
        "!!document.querySelector('.yk-pack-panel .yk-pack-body > button')"
      );
      await until(
        "(()=>{const b=document.querySelector('.yk-pack-panel .yk-pack-body > button');return b&&Object.entries(b).some(([k,v])=>k.startsWith('__reactProps')&&typeof v.onClick==='function');})()"
      );
      console.log("hydrated", pack + 1);
      await evaluate(
        "document.querySelector('.yk-pack-panel .yk-pack-body > button').click()"
      );
    } else {
      await evaluate(
        "document.querySelector('.yk-reveal-next > button').click()"
      );
    }
    await until("!!document.querySelector('.yk-booster-opening iframe')");
    console.log("opening iframe", pack + 1);
    assert.equal(
      await evaluate(
        "document.querySelectorAll('.yk-pack-tear,.yk-opening-pack').length"
      ),
      0
    );
    for (const width of [320, 375, 600, 768, 900, 1024, 1440]) {
      await viewport(width);
      const bounds = await evaluate(
        "(()=>{const r=document.querySelector('.yk-booster-opening').getBoundingClientRect();return {w:r.width,h:r.height,overflow:document.documentElement.scrollWidth>innerWidth};})()"
      );
      assert.equal(bounds.overflow, false, JSON.stringify({ width, bounds }));
    }
    await viewport(1440, 2);
    assert.equal(
      await evaluate("document.documentElement.scrollWidth>innerWidth"),
      false
    );
    await viewport(1440);
    await evaluate("document.querySelector('.yk-opening-stage').click()");
    await delay(200);
    await evaluate("document.querySelector('.yk-opening-stage')?.click()");
    await until("!!document.querySelector('.yk-deck-button')");
    for (let card = 0; card < 5; card++) {
      await evaluate("document.querySelector('.yk-deck-button').click()");
      if (card >= 3) {
        await until("!!document.querySelector('.yk-card-cinematic iframe')");
        assert.equal(
          await evaluate(
            "document.querySelectorAll('.yk-card-cinematic iframe').length"
          ),
          1
        );
        assert.equal(
          await evaluate(
            "document.querySelectorAll('.yk-ssr-cinematic-stage,.yk-lr-cinematic-stage,.yk-reveal-stage').length"
          ),
          0
        );
        await until("!document.querySelector('.yk-lr-preview-status')");
        if (pack === 0) {
          for (const width of [320, 375, 768, 1024, 1440]) {
            await viewport(width);
            assert.equal(
              await evaluate("document.documentElement.scrollWidth>innerWidth"),
              false
            );
            const bounds = await evaluate(
              "(()=>{const r=document.querySelector('.yk-card-cinematic iframe').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight};})()"
            );
            assert.ok(
              bounds.left >= -1 &&
                bounds.right <= bounds.w + 1 &&
                bounds.top >= -1 &&
                bounds.bottom <= bounds.h + 1,
              JSON.stringify({ width, bounds })
            );
          }
          await viewport(1440, 2);
          assert.equal(
            await evaluate("document.documentElement.scrollWidth>innerWidth"),
            false
          );
          await viewport(1440);
          if (process.env.CAPTURE_SCREENSHOTS === "1") {
            await delay(card === 3 ? 7000 : 12000);
            const { data } = await send("Page.captureScreenshot", {
              format: "png"
            });
            await writeFile(
              new URL(
                `../artifacts/single-animation/${card === 3 ? "SSR" : "LR"}.png`,
                import.meta.url
              ),
              Buffer.from(data, "base64")
            );
          }
        }
        await evaluate(
          "document.querySelector('.yk-card-cinematic-skip').click()"
        );
      } else if (card === 2) await delay(550);
      await until("!!document.querySelector('.yk-deck-button')");
      await evaluate("document.querySelector('.yk-deck-button').click()");
    }
    await until(
      "document.querySelector('.yk-reveal-screen')?.dataset.revealState==='complete'"
    );
    assert.equal(
      await evaluate("document.querySelectorAll('iframe').length"),
      0
    );
    await send("HeapProfiler.collectGarbage");
    if (pack > 0)
      report.push({
        pack,
        ...(await send("Memory.getDOMCounters")),
        heap: await send("Runtime.getHeapUsage")
      });
  }
  console.log(JSON.stringify({ report, errors }, null, 2));
  assert.equal(errors.length, 0);
  assert.equal(
    requests.length,
    0,
    "simulated packs must not call the reward API"
  );
  assert.ok(report[4].nodes <= report[0].nodes + 40, JSON.stringify(report));
  assert.ok(
    report[4].jsEventListeners <= report[0].jsEventListeners + 40,
    JSON.stringify(report)
  );
  assert.ok(
    report[4].heap.usedSize <= report[0].heap.usedSize * 1.2,
    JSON.stringify(report)
  );
} finally {
  socket?.close();
  browser.kill();
}
