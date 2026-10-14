import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
      url: `http://localhost:3000/design-system/profile-preview${suffix}${suffix ? "&" : "?"}catalogue=demo`
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
  const assertAlignedProfile = async label => {
    await waitFor(
      "(() => {const counts=document.querySelector('.yk-profile-side-counts').getBoundingClientRect();const stats=document.querySelector('.yk-profile-side-stats').getBoundingClientRect();const member=document.querySelector('.yk-profile-member').getBoundingClientRect();return counts.bottom <= stats.top && stats.bottom <= member.top;})()"
    );
    await waitFor("document.documentElement.scrollWidth <= window.innerWidth");
    await waitFor(
      "(() => {const left=document.querySelector('.yk-profile-identity').getBoundingClientRect(); const right=document.querySelector('.yk-profile-main').getBoundingClientRect(); const showcase=document.querySelector('.yk-profile-main .yk-profile-panel:not([hidden]) > section:last-child').getBoundingClientRect(); return Math.abs(left.bottom-right.bottom) < 1 && Math.abs(left.bottom-showcase.bottom) < 1;})()"
    );
    assert.ok(
      await evaluate(
        "(() => {const left=document.querySelector('.yk-profile-identity').getBoundingClientRect();const right=document.querySelector('.yk-profile-main').getBoundingClientRect();return Math.abs(left.top-right.top)<1;})()"
      ),
      `Profile columns share top and bottom: ${label}`
    );
  };
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await navigate("");
  await waitFor(
    "document.querySelector('[data-profile-views]').textContent.replace(/\\s/g,'') === '1284'"
  );
  assert.equal(
    await evaluate(
      "document.querySelector('.yk-profile-side-counts').textContent.includes('Amis') || document.querySelector('.yk-profile-side-counts').textContent.includes('Wishlist')"
    ),
    false,
    "Sidebar replaces duplicate friend/wishlist counts with engagement"
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-side-counts').textContent.includes('Likes')"
    )
  );
  assert.equal(
    await evaluate(
      "Array.from(document.querySelectorAll('button')).filter(button=>button.textContent.includes('Aimer ce profil') || button.textContent.includes('Profil aimé')).length"
    ),
    0,
    "Cannot like own profile"
  );
  await assertAlignedProfile("1440px");
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-identity').getBoundingClientRect().width >= 400"
    ),
    "Desktop identity panel is wider than the former 320px"
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-main').getBoundingClientRect().width >= 700"
    ),
    "The wider page preserves room for the tabs and widgets"
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.yk-profile-identity .yk-profile-banner')).height"
    ),
    "190px"
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await assertAlignedProfile("1920px");
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-identity').getBoundingClientRect().width >= 440"
    ),
    "Wide-screen profile uses the left-hand space"
  );
  if (
    await evaluate("document.documentElement.scrollWidth > window.innerWidth")
  )
    console.log(
      await evaluate(
        "({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main, .yk-profile-hub, .yk-profile-main, .yk-profile-panel, .yk-profile-surface, .yk-featured-stage')].map(node=>({class:node.className,width:node.getBoundingClientRect().width,right:node.getBoundingClientRect().right,cssWidth:getComputedStyle(node).width}))})"
      )
    );
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    "No desktop horizontal overflow"
  );
  await capture("desktop-wide.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 2560,
    height: 1440,
    deviceScaleFactor: 1,
    mobile: false
  });
  await assertAlignedProfile("2560px");
  await capture("desktop-large-aligned.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 3840,
    height: 2160,
    deviceScaleFactor: 1,
    mobile: false
  });
  await assertAlignedProfile("3840px");
  for (const width of [1024, 901]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await assertAlignedProfile(`${width}px`);
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-identity').getBoundingClientRect().right < document.querySelector('.yk-profile-main').getBoundingClientRect().left"
    ),
    "Identity is left of the tabs on desktop"
  );
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
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-preferences-form textarea').length"
    ),
    0,
    "No free text favorites input"
  );
  await waitFor(
    "document.querySelectorAll('.yk-profile-license-results button').length > 0"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-widget-picker button')).find(button=>button.textContent.includes('ANIME/MANGA')).click()"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-widget-editor').length"
    ),
    4,
    "Clicking a selected category opens its licences without removing the widget"
  );
  for (const name of ["One Piece", "Black Butler", "Jujutsu Kaisen"])
    await evaluate(
      `Array.from(document.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')===${JSON.stringify(`Retirer ${name} des favoris ANIME/MANGA`)}).click()`
    );
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-license-results button')).find(button=>button.textContent.includes('Bleach')).click()"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-widget-picker button')).find(button=>button.textContent.includes('KDRAMA')).click()"
  );
  await waitFor(
    "document.querySelectorAll('.yk-profile-widget-editor').length === 5"
  );
  await waitFor(
    "Array.from(document.querySelectorAll('.yk-profile-license-results button')).some(button=>button.textContent.includes('Goblin'))"
  );
  await evaluate(
    `(() => {const input=document.querySelector('.yk-profile-license-picker input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'gob'); input.dispatchEvent(new Event('input',{bubbles:true}));})()`
  );
  await waitFor(
    "document.querySelectorAll('.yk-profile-license-results button').length === 1"
  );
  await evaluate(
    "document.querySelector('.yk-profile-license-results button').click()"
  );
  for (let i = 0; i < 4; i++) {
    await evaluate(
      "document.querySelector('button[aria-label=\"Monter le widget KDRAMA\"]').click()"
    );
    await delay(80);
  }
  await evaluate(
    "document.querySelector('button[aria-label=\"Retirer le widget FILM\"]').click()"
  );
  await capture("widgets-editor.png");
  await evaluate(
    "document.querySelector('.yk-profile-preferences-form button[type=submit]').click()"
  );
  await waitFor("!document.querySelector('.yk-profile-preferences-form')");
  await assertAlignedProfile("after widget edits");
  assert.ok(
    await evaluate(
      "Array.from(document.querySelectorAll('.yk-profile-taste-list')).some(list=>list.textContent.includes('Bleach'))"
    )
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-widget-category]').dataset.widgetCategory"
    ),
    "KDRAMA"
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-widget-category=FILM]').length"
    ),
    0
  );
  assert.ok(
    await evaluate(
      "document.querySelector('[data-widget-category=KDRAMA]').textContent.includes('Goblin')"
    )
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Modifier le profil').click()"
  );
  await waitFor(
    "Boolean(document.querySelector('input[aria-label=\"Importer une bannière\"]'))"
  );
  await send("DOM.enable");
  const documentNode = await send("DOM.getDocument");
  const bannerInput = await send("DOM.querySelector", {
    nodeId: documentNode.root.nodeId,
    selector: 'input[aria-label="Importer une bannière"]'
  });
  await send("DOM.setFileInputFiles", {
    nodeId: bannerInput.nodeId,
    files: [
      fileURLToPath(
        new URL("../public/assets/landing/luffy.webp", import.meta.url)
      )
    ]
  });
  await waitFor(
    "Boolean(document.querySelector('.yk-profile-banner-preview')?.src.startsWith('blob:'))"
  );
  await capture("banner-editor.png");
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Enregistrer').click()"
  );
  await waitFor("!document.querySelector('.yk-profile-banner-editor')");
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-identity .yk-profile-banner img').src.startsWith('blob:')"
    )
  );
  await capture("desktop.png");
  await assertAlignedProfile("after imported banner");
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Modifier le profil').click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.yk-profile-banner-preview'))"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Retirer la bannière').click()"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Enregistrer').click()"
  );
  await waitFor("!document.querySelector('.yk-profile-banner-editor')");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-identity .yk-profile-banner img').length"
    ),
    0
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Personnaliser mon tableau').click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.yk-profile-preferences-form'))"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-widget-tools button')).filter(button=>button.getAttribute('aria-label')?.startsWith('Retirer le widget')).forEach(button=>button.click())"
  );
  await waitFor(
    "document.querySelectorAll('.yk-profile-widget-editor').length === 0"
  );
  await evaluate(
    "document.querySelector('.yk-profile-preferences-form button[type=submit]').click()"
  );
  await waitFor("!document.querySelector('.yk-profile-preferences-form')");
  await assertAlignedProfile("without widgets");
  await navigate("?visitor=1");
  const assertModerationPlacement = async () => {
    assert.ok(
      await evaluate(
        "(() => {const name=document.querySelector('.yk-profile-name-row h2').getBoundingClientRect();const menu=document.querySelector('.yk-profile-name-row summary').getBoundingClientRect();return name.right <= menu.left && Math.abs((name.top+name.bottom)/2-(menu.top+menu.bottom)/2)<1;})()"
      ),
      "Report menu sits next to the username"
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('.yk-profile-actions summary').length"
      ),
      0,
      "Report menu no longer sits among friend actions"
    );
  };
  await assertModerationPlacement();
  await evaluate(
    "document.querySelector('.yk-profile-name-row summary').click()"
  );
  await waitFor("document.querySelector('.yk-profile-name-row details').open");
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-name-row details').textContent.includes('Bloquer') && document.querySelector('.yk-profile-name-row details').textContent.includes('Signaler')"
    )
  );
  await capture("report-menu.png");
  await evaluate(
    "Array.from(document.querySelectorAll('.yk-profile-name-row button')).find(button=>button.textContent==='Signaler').click()"
  );
  await waitFor(
    "Boolean(document.querySelector('dialog[open]')?.textContent.includes('Signaler Toba'))"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('dialog[open] button')).find(button=>button.textContent==='Annuler').click()"
  );
  await waitFor("!document.querySelector('dialog[open]')");
  await evaluate(
    "document.querySelector('.yk-profile-name-row summary').click()"
  );
  await waitFor(
    "document.querySelector('[data-profile-views]').textContent.replace(/\\s/g,'') === '1285'"
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-profile-likes]').textContent"
    ),
    "42"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('Aimer ce profil')).click()"
  );
  await waitFor(
    "document.querySelector('[data-profile-likes]').textContent === '43'"
  );
  assert.equal(
    await evaluate(
      "Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('Profil aimé')).getAttribute('aria-pressed')"
    ),
    "true"
  );
  await evaluate(
    "Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('Profil aimé')).click()"
  );
  await waitFor(
    "document.querySelector('[data-profile-likes]').textContent === '42'"
  );
  await clickTab("Amis");
  assert.equal(
    await evaluate(
      "document.querySelector('[data-profile-views]').textContent.replace(/\\s/g,'')"
    ),
    "1285",
    "Tabs and likes don't count as additional profile visits"
  );
  await evaluate(
    "document.querySelector('.yk-profile-panel:not([hidden]) .yk-profile-filter').click()"
  );
  await delay(150);
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.yk-profile-friend-list li').length"
    ),
    2
  );
  await capture("mutual-friends.png");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    "No tablet-width horizontal overflow"
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.yk-profile-identity').getBoundingClientRect().width >= 360"
    )
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await capture("mobile.png");
  await assertModerationPlacement();
  assert.ok(
    await evaluate(
      "(() => {const counts=document.querySelector('.yk-profile-side-counts').getBoundingClientRect();const stats=document.querySelector('.yk-profile-side-stats').getBoundingClientRect();const member=document.querySelector('.yk-profile-member').getBoundingClientRect();return counts.bottom <= stats.top && stats.bottom <= member.top;})()"
    ),
    "Mobile keeps counts, boosters/rarities, then membership date"
  );
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    "No horizontal overflow on mobile"
  );
  await send("Page.navigate", {
    url: "http://localhost:3000/design-system/profile-preview?visitor=1&private=1&catalogue=demo"
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
    "Profile browser proof OK: no free-text favorites, category license lists, search/select/save, left identity, tabs, widget ordering, banner upload/save/remove, completion, activity, wishlist, mutual friends, privacy and mobile width."
  );
  await send("Browser.close");
} finally {
  socket?.close();
  browser.kill();
}
