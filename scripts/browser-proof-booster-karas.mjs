const endpoint = "http://localhost:9222";

async function newPage(url) {
  const page = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const promise = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) promise.reject(new Error(message.error.message));
    else promise.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => (await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Page.navigate", { url });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("document.readyState === 'complete' && !!document.querySelector('[data-proof=regular] button')")) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  return { socket, evaluate };
}

async function clickAndRead(page, section, label, occurrence = 0) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const dismissed = await page.evaluate(`(() => {
      const dialog = document.querySelector('dialog[open]');
      const close = dialog?.querySelector('button[aria-label="Fermer"]');
      if (!close) return false;
      close.click();
      return true;
    })()`);
    if (!dismissed) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const clicked = await page.evaluate(`(() => {
    const root = document.querySelector('[data-proof=${section}]');
    const button = [...root.querySelectorAll('button')].filter(node => node.textContent.includes(${JSON.stringify(label)}))[${occurrence}];
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Bouton ${label} introuvable dans ${section}`);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await page.evaluate("!!document.querySelector('dialog[open]')")) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const result = await page.evaluate(`(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return null;
    return { dialog: dialog?.textContent.replace(/\\s+/g, ' ').trim(), action: [...dialog.querySelectorAll('button')].at(-1)?.textContent };
  })()`);
  if (!result) throw new Error(`Aucune modale après le clic ${occurrence + 1} dans ${section}`);
  return result;
}

async function scenario(disabled) {
  const suffix = disabled ? "?disabled=1" : "";
  const regularPage = await newPage(`http://localhost:3000/design-system/booster-karas-preview${suffix}`);
  const regular = await clickAndRead(regularPage, "regular", "Défausser");
  regularPage.socket.close();

  const decisions = [];
  for (let index = 0; index < 5; index++) {
    const decisionPage = await newPage(`http://localhost:3000/design-system/booster-karas-preview${suffix}`);
    decisions.push(await clickAndRead(decisionPage, "decision", "Garder celle-ci", index));
    decisionPage.socket.close();
  }
  return { regular, decisions };
}

const enabled = await scenario(false);
const counterproof = await scenario(true);
console.log(JSON.stringify({ enabled, counterproof }, null, 2));

if (!enabled.regular.dialog.includes("Tu recevras 1 Kara") || enabled.regular.action !== "Défausser") process.exitCode = 1;
const expectedRewards = [15, 15, 14, 13, 15];
if (enabled.decisions.some((result, index) => !result.dialog.includes(`+${expectedRewards[index]} Karas depuis les cartes non conservées`))) process.exitCode = 1;
if (counterproof.regular.dialog.includes("Tu recevras") || counterproof.regular.action !== "Défausser") process.exitCode = 1;
if (counterproof.decisions.some(result => result.dialog.includes("Karas depuis les cartes non conservées"))) process.exitCode = 1;
