import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = new URL("../artifacts/profile-wishlist/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = spawn(
  process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--remote-debugging-port=9227",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "yokkai-wishlist-"))}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await delay(100);
    try {
      target = await (
        await fetch("http://127.0.0.1:9227/json/new?about:blank", {
          method: "PUT"
        })
      ).json();
    } catch {}
  }
  assert.ok(target, "Chrome available");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve =>
    socket.addEventListener("open", resolve, { once: true })
  );
  let id = 0;
  const pending = new Map();
  const trackingRequests = [];
  const exceptions = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      exceptions.push(message.params.exceptionDetails.text);
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params.request;
      if (
        `${request.url} ${request.postData ?? ""}`.includes(
          "record_profile_view"
        )
      )
        trackingRequests.push(request.url);
    }
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(message.error);
    else resolve(message.result);
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
  const waitFor = async expression => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const navigate = async (suffix = "") => {
    await send("Page.navigate", {
      url: `http://localhost:3000/design-system/profile-preview?catalogue=demo${suffix}`
    });
    await waitFor("Boolean(document.querySelector('[data-profile-wishlist]'))");
    await waitFor(
      "document.querySelector('[data-profile-likes]').textContent==='42'"
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-profile-views]').length"
      ),
      0
    );
    assert.equal(
      await evaluate(
        "document.querySelector('.yk-profile-side-counts').textContent.includes('Vues du profil')"
      ),
      false
    );
    assert.deepEqual(
      await evaluate(
        "Array.from(document.querySelectorAll('.yk-profile-tabs button')).map(button=>button.textContent.trim())"
      ),
      suffix.includes("private=1") && !suffix.includes("friend=1")
        ? ["Tableau", "Mur", "Activité"]
        : ["Tableau", "Mur", "Activité", "Amis3"]
    );
  };
  const click = selector =>
    evaluate(
      `(() => {const target=document.querySelector(${JSON.stringify(selector)});target.focus();target.click();})()`
    );
  const close = async () => {
    await click('dialog[open] [aria-label="Fermer"]');
    await waitFor("!document.querySelector('dialog[open]')");
  };
  const capture = async name => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL(name, output), Buffer.from(data, "base64"));
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await navigate();
  await waitFor(
    "document.querySelector('[data-profile-wishlist] strong').textContent==='3'"
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-profile-wishlist]').getAttribute('aria-haspopup')"
    ),
    "dialog"
  );
  const initialUrl = await evaluate("location.href");
  await click("[data-profile-wishlist]");
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===3"
  );
  assert.ok(
    await evaluate(
      "document.querySelector('dialog[open]').textContent.includes('Wishlist de Toba')"
    )
  );
  assert.equal(await evaluate("location.href"), initialUrl);
  assert.deepEqual(
    await evaluate(
      "Array.from(document.querySelectorAll('dialog[open] .yk-wishlist-grid a')).map(a=>a.getAttribute('href'))"
    ),
    [
      "/recherche?carte=preview-0",
      "/recherche?carte=preview-1",
      "/recherche?carte=preview-2"
    ]
  );
  await evaluate(
    "(() => {const input=document.querySelector('#friend-wishlist-query');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'gojo');input.dispatchEvent(new Event('input',{bubbles:true}));})()"
  );
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===1"
  );
  assert.ok(
    await evaluate(
      "document.querySelector('dialog[open] .yk-wishlist-grid a').getAttribute('aria-label').includes('GOJO')"
    )
  );
  await click("dialog[open] .yk-filter-reset");
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===3"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('dialog[open] .yk-filter-option')).find(button=>button.textContent.trim()==='SSR').click()"
  );
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===2"
  );
  await click("dialog[open] .yk-filter-reset");
  await evaluate(
    "Array.from(document.querySelectorAll('dialog[open] .yk-filter-option')).find(button=>button.textContent.trim()==='ANIME/MANGA').click()"
  );
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===3"
  );
  await capture("wishlist-desktop.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await waitFor(
    "(() => {const dialog=document.querySelector('dialog[open]');return dialog.scrollWidth<=dialog.clientWidth&&document.documentElement.scrollWidth<=window.innerWidth;})()"
  );
  await capture("wishlist-mobile.png");
  await close();
  assert.ok(
    await evaluate("document.activeElement.matches('[data-profile-wishlist]')"),
    "Closing restores focus to the counter"
  );
  await navigate("&visitor=1");
  await click("[data-profile-wishlist]");
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===3"
  );
  await close();
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-actions + button, .yk-profile-identity-content > button')).find(button=>button.textContent.includes('Aimer ce profil')).click()"
  );
  await waitFor(
    "document.querySelector('[data-profile-likes]').textContent==='43'"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('Profil aimé')).click()"
  );
  await waitFor(
    "document.querySelector('[data-profile-likes]').textContent==='42'"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-tabs button')).find(button=>button.textContent==='Activité').click()"
  );
  await waitFor("document.querySelectorAll('.yk-profile-sale').length===2");
  await click(".yk-profile-sale");
  await waitFor(
    "Boolean(document.querySelector('dialog[open] .yk-bid-quick'))"
  );
  await close();
  await navigate("&visitor=1&private=1");
  assert.equal(
    await evaluate(
      "document.querySelector('[data-profile-wishlist]').disabled"
    ),
    true
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-profile-wishlist] strong').textContent"
    ),
    "Privée"
  );
  await click("[data-profile-wishlist]");
  assert.equal(
    await evaluate("document.querySelectorAll('dialog[open]').length"),
    0
  );
  await navigate("&visitor=1&private=1&friend=1");
  await click("[data-profile-wishlist]");
  await waitFor(
    "document.querySelectorAll('dialog[open] .yk-wishlist-grid a').length===3"
  );
  await close();
  await navigate("&wishlistEmpty=1");
  await click("[data-profile-wishlist]");
  await waitFor(
    "document.querySelector('dialog[open]')?.textContent.includes('Aucune carte souhaitée')"
  );
  await close();
  assert.deepEqual(
    trackingRequests,
    [],
    "No record_profile_view request on visits, likes, tabs or modal interactions"
  );
  assert.deepEqual(exceptions, []);
  console.log(
    "Profile wishlist proof OK: counter, old modal, search/rarity/category, links, mobile, focus, owner/friend/private, likes, sales and zero view recording."
  );
  await send("Browser.close");
} finally {
  socket?.close();
  browser.kill();
}
