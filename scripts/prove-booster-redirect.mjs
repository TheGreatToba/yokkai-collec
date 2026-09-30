import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000/design-system/booster-redirect-preview";
const scenario = process.argv[3] ?? "auto";
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = await mkdtemp(join(tmpdir(), "yokkai-booster-redirect-proof-"));
const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9226", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

let socket;
try {
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try { target = await fetch("http://127.0.0.1:9226/json/new?about:blank", { method: "PUT" }).then(response => response.json()); } catch {}
  }
  if (!target) throw new Error("Chrome DevTools est inaccessible.");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(message.error); else entry.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const waitFor = async (expression, label, attempts = 50) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const value = await evaluate(expression);
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`${label} introuvable.`);
  };
  const click = async selector => {
    const point = await waitFor(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)return null;element.scrollIntoView({block:'center'});const rect=element.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`, "Cible du clic");
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await waitFor("document.body?.textContent.includes('Redirection vers la Collection dans 3 secondes')", "Indice de redirection");
  await new Promise(resolve => setTimeout(resolve, 500));

  if (scenario === "cancel-next") {
    await click(".yk-reveal-summary button.yk-button-primary");
    await new Promise(resolve => setTimeout(resolve, 3400));
    const events = await evaluate("window.__boosterRedirectProof ?? []");
    if (events.join(",") !== "next") throw new Error(`La redirection n'a pas été annulée : ${events.join(",")}.`);
    console.log(JSON.stringify({ url, scenario, events, redirectCancelled: true, result: "passed" }));
  } else if (scenario === "link") {
    const startedAt = Date.now();
    await click("a[href='/collection']");
    const destination = await waitFor("location.pathname !== '/design-system/booster-redirect-preview' && location.pathname", "Navigation immédiate");
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 3000) throw new Error(`Le lien a attendu le minuteur (${elapsedMs} ms).`);
    console.log(JSON.stringify({ url, scenario, destination, elapsedMs, result: "passed" }));
  } else {
    const events = await waitFor("window.__boosterRedirectProof?.includes('collection') && window.__boosterRedirectProof", "Redirection automatique", 40);
    console.log(JSON.stringify({ url, scenario, events, result: "passed" }));
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  browser.kill();
}
