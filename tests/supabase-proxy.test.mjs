import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { NextRequest, NextResponse } from "next/server.js";
import ts from "typescript";

function loadProxy(getClaims) {
  const source = ts.transpileModule(
    readFileSync(new URL("../utils/supabase/proxy.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const context = {
    exports: {},
    Headers,
    require(name) {
      if (name === "next/server") return { NextResponse };
      if (name === "@/utils/supabase/config") {
        return { getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "test-key" }) };
      }
      if (name === "@supabase/ssr") {
        return { createServerClient: (_url, _key, { cookies }) => ({
          auth: { getClaims: () => getClaims(cookies) },
        }) };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(source, context);
  return context.exports.updateSession;
}

test("le proxy vérifie la session et laisse passer un visiteur sans cookie", async () => {
  let checked = false;
  const updateSession = loadProxy(async (cookies) => {
    assert.equal(cookies.getAll().length, 0);
    checked = true;
    return { data: null, error: null };
  });
  const response = await updateSession(new NextRequest("http://localhost/"));
  assert.equal(checked, true);
  assert.equal(response.status, 200);
  assert.equal(response.cookies.getAll().length, 0);
});

test("le renouvellement propage les cookies au rendu et au navigateur sans perdre les en-têtes", async () => {
  const request = new NextRequest("http://localhost/collection", {
    headers: { cookie: "session=expired; old-chunk=obsolete" },
  });
  const updateSession = loadProxy(async (cookies) => {
    assert.equal(cookies.getAll().find(({ name }) => name === "session").value, "expired");
    cookies.setAll([
      { name: "session", value: "refreshed", options: { path: "/", sameSite: "lax", secure: true } },
    ], { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" });
    // Supabase only delivers cache headers on the first write of a request.
    cookies.setAll([
      { name: "old-chunk", value: "", options: { path: "/", maxAge: 0 } },
    ], {});
    return { data: { claims: { sub: "user-id" } }, error: null };
  });
  const response = await updateSession(request);
  assert.equal(request.cookies.get("session").value, "refreshed");
  assert.match(response.headers.get("x-middleware-request-cookie"), /session=refreshed/);
  assert.equal(response.cookies.get("session").value, "refreshed");
  assert.equal(response.cookies.get("session").secure, true);
  assert.equal(response.cookies.get("session").sameSite, "lax");
  assert.equal(response.cookies.get("old-chunk").maxAge, 0);
  assert.match(response.headers.get("Cache-Control"), /private.*no-store/);
  assert.equal(response.headers.get("Expires"), "0");
  assert.equal(response.headers.get("Pragma"), "no-cache");
});
