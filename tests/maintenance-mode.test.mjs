import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { NextRequest } from "next/server.js";
import ts from "typescript";

function loadProxy(maintenanceMode) {
  const source = ts.transpileModule(
    readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  let sessionChecks = 0;
  const context = {
    exports: {},
    process: { env: { MAINTENANCE_MODE: maintenanceMode } },
    Response,
    require(name) {
      if (name === "@/utils/supabase/proxy") {
        return { updateSession: () => { sessionChecks += 1; return new Response("application"); } };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(source, context);
  return { proxy: context.exports.proxy, sessionChecks: () => sessionChecks };
}

test("le mode maintenance intercepte toutes les routes avant la session", async () => {
  for (const path of ["/", "/collection", "/api/private-action"]) {
    const loaded = loadProxy("true");
    const response = await loaded.proxy(new NextRequest(`http://localhost${path}`));
    const html = await response.text();

    assert.equal(response.status, 503);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.match(html, /Yokkai Collec' est en maintenance/);
    assert.equal(loaded.sessionChecks(), 0);
  }
});

test("une valeur autre que true laisse fonctionner l'application", async () => {
  const loaded = loadProxy("false");
  const response = await loaded.proxy(new NextRequest("http://localhost/collection"));

  assert.equal(await response.text(), "application");
  assert.equal(loaded.sessionChecks(), 1);
});
