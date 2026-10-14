import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = new URL("../artifacts/profile-dashboard/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = spawn(
  process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--remote-debugging-port=9225",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-profile-"))}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await delay(100);
    try {
      target = await (
        await fetch("http://127.0.0.1:9225/json/new?about:blank", {
          method: "PUT"
        })
      ).json();
    } catch {}
  }
  assert.ok(target, "Chrome DevTools available");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve =>
    socket.addEventListener("open", resolve, { once: true })
  );
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(message.error) : resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  const evaluate = async expression => {
    const value = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    assert.ok(!value.exceptionDetails, JSON.stringify(value.exceptionDetails));
    return value.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await delay(150);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const navigate = async suffix => {
    await send("Page.navigate", {
      url: `http://localhost:3000/design-system/profile-preview${suffix}`
    });
    await waitFor(
      "Boolean(document.querySelector('.yk-profile-hub') && document.querySelector('.yk-profile-side-stats').textContent.includes('824'))"
    );
  };
  const clickTab = async label => {
    await evaluate(
      `Array.from(document.querySelectorAll('.yk-profile-tabs button')).find(button=>button.textContent.startsWith(${JSON.stringify(label)})).click()`
    );
    await delay(120);
    assert.ok(
      await evaluate(
        `Boolean(document.querySelector('.yk-profile-tabs button.is-active').textContent.startsWith(${JSON.stringify(label)}))`
      )
    );
  };
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL(name, output), Buffer.from(data, "base64"));
  };
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await navigate("");
  await capture("desktop.png");
  await clickTab("Complétion");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-album-progress progress').length"
    ),
    6
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.yk-profile-completion-summary > strong').textContent"
    ),
    "1"
  );
  await capture("completion.png");
  await clickTab("Activité");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-activity li').length"
    ),
    3
  );
  await capture("activity.png");
  await clickTab("Wishlist");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-wishlist-preview a').length"
    ),
    3
  );
  await clickTab("Tableau");
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Personnaliser mon tableau').click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.yk-profile-preferences-form'))"
  );
  await evaluate(
    `(() => {const input=document.querySelector('.yk-profile-preferences-form textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Bleach\\nNoragami'); input.dispatchEvent(new Event('input',{bubbles:true}));})()`
  );
  await delay(150);
  await evaluate(
    "document.querySelector('.yk-profile-preferences-form button[type=submit]').click()"
  );
  await waitFor("!document.querySelector('.yk-profile-preferences-form')");
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-taste-list').textContent.includes('Bleach')"
    )
  );
  await navigate("?visitor=1");
  await clickTab("Amis");
  await evaluate("document.querySelector('.yk-profile-filter').click()");
  await delay(150);
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-friend-list li').length"
    ),
    2
  );
  await capture("mutual-friends.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await capture("mobile.png");
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    "No horizontal overflow on mobile"
  );
  await send("Page.navigate", {
    url: "http://localhost:3000/design-system/profile-preview?visitor=1&private=1"
  });
  await waitFor(
    "Boolean(document.querySelector('.yk-profile-side-stats')?.textContent.includes('Privé'))"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-activity li, .yk-profile-album-progress li, .yk-profile-friend-list li').length"
    ),
    0
  );
  console.log(
    "Profile browser proof OK: tabs, completion, activity, wishlist, preferences, mutual friends, privacy and mobile width."
  );
  await send("Browser.close");
} finally {
  socket?.close();
  browser.kill();
}
