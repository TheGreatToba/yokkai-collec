import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

function loadModule(path, imports = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, URL, ...globals, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } };
  vm.runInNewContext(code, context);
  return context.exports;
}

const forms = loadModule("../lib/auth/forms.ts");
const form = (values = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ email: "joueur@example.com", password: "  secret123  ", pseudo: "  Yokkai  ", ...values })) {
    data.set(key, value);
  }
  return data;
};

function actions(auth, env = { NEXT_PUBLIC_SITE_URL: "https://yokkai.example", NODE_ENV: "production" }) {
  const revalidated = [];
  const loaded = loadModule("../app/auth/actions.ts", {
    "next/headers": { cookies: async () => ({}) },
    "next/navigation": { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
    "@/utils/supabase/server": { createClient: () => ({ auth }) },
    "@/lib/auth/forms": forms,
  }, { process: { env } });
  return { ...loaded, revalidated };
}

test("inscription : validation serveur et conservation exacte du mot de passe", async () => {
  const input = forms.validateCredentials(form(), true);
  assert.equal(input.password, "  secret123  ");
  assert.equal(input.pseudo, "Yokkai");
  const result = await actions({}).signUp({}, form({ pseudo: " ", email: "bad", password: "short" }));
  assert.ok(result.fields.email);
  assert.ok(result.fields.password);
  assert.ok(result.fields.pseudo);
  assert.equal("password" in result.values, false);
  assert.equal(forms.validateCredentials(form({ password: "old" }), false).valid, true);
});

test("inscription : pseudo transmis au trigger, confirmation requise sans fausse session", async () => {
  let sent;
  const api = actions({ signUp: async (input) => { sent = input; return { data: { session: null }, error: null }; } });
  const result = await api.signUp({}, form());
  assert.equal(sent.options.data.pseudo, "Yokkai");
  assert.equal(sent.options.emailRedirectTo, "https://yokkai.example/auth/confirm");
  assert.equal(result.success, true);
  assert.equal(api.revalidated.length, 0);
  assert.equal(JSON.stringify(result).includes("secret123"), false);
});

test("inscription sans confirmation et connexion : session puis invalidation du rendu", async () => {
  const api = actions({
    signUp: async () => ({ data: { session: { access_token: "private" } }, error: null }),
    signInWithPassword: async (input) => {
      assert.equal(input.password, "  secret123  ");
      return { error: null };
    },
  });
  await assert.rejects(api.signUp({}, form()), /REDIRECT:\/$/);
  await assert.rejects(api.signIn({}, form()), /REDIRECT:\/$/);
  assert.equal(api.revalidated.length, 2);
});

test("erreurs Auth : messages français, pas de détails techniques ni de mot de passe", async () => {
  for (const code of ["invalid_credentials", "email_not_confirmed", "over_request_rate_limit", "unexpected_failure"]) {
    const result = await actions({ signInWithPassword: async () => ({ error: { code, message: "SECRET PROVIDER DETAILS" } }) }).signIn({}, form());
    assert.ok(result.error);
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.equal(JSON.stringify(result).includes("secret123"), false);
  }
  const result = await actions({ signUp: async () => { throw new Error("network"); } }).signUp({}, form());
  assert.match(result.error, /indisponible/);
});

test("connexion : un incident réseau transitoire est retenté une seule fois", async () => {
  let attempts = 0;
  const api = actions({
    signInWithPassword: async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("fetch failed");
      return { error: { code: "invalid_credentials", message: "provider details" } };
    },
  });
  const result = await api.signIn({}, form());
  assert.equal(attempts, 2);
  assert.match(result.error, /incorrect/);
});

test("connexion : une erreur Auth levée conserve son code utilisateur", async () => {
  const api = actions({
    signInWithPassword: async () => {
      throw Object.assign(new Error("provider details"), { code: "email_not_confirmed" });
    },
  });
  const result = await api.signIn({}, form());
  assert.match(result.error, /Confirmez/);
  assert.equal(JSON.stringify(result).includes("provider details"), false);
});

test("production : aucune inscription avec une URL de retour manquante ou invalide", async () => {
  for (const site of ["", "http://yokkai.example", "javascript:alert(1)", "https://user:password@example.com"]) {
    const result = await actions({ signUp: () => assert.fail("must not send email") }, {
      NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: site,
    }).signUp({}, form());
    assert.ok(result.error);
  }
});

test("déconnexion locale, propagation des erreurs et redirection après succès", async () => {
  const api = actions({ signOut: async ({ scope }) => { assert.equal(scope, "local"); return { error: null }; } });
  await assert.rejects(api.signOut(), /REDIRECT:\/connexion/);
  const failed = await actions({ signOut: async () => ({ error: { message: "network" } }) }).signOut();
  assert.match(failed.error, /échoué/);
});

function confirm(auth) {
  return loadModule("../app/auth/confirm/route.ts", {
    "next/headers": { cookies: async () => ({}) },
    "next/server": { NextResponse },
    "@/utils/supabase/server": { createClient: () => ({ auth }) },
  }).GET;
}

test("confirmation : code PKCE et token email, redirection interne sans tokens et sans cache", async () => {
  const handler = confirm({
    exchangeCodeForSession: async (code) => { assert.equal(code, "valid"); return { error: null }; },
    verifyOtp: async (input) => { assert.equal(input.token_hash, "hash"); assert.equal(input.type, "email"); return { error: null }; },
  });
  for (const query of ["code=valid", "token_hash=hash&type=email"]) {
    const response = await handler(new NextRequest(`https://yokkai.example/auth/confirm?${query}&next=https://evil.example`));
    assert.equal(response.headers.get("location"), "https://yokkai.example/");
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
});

test("confirmation : lien absent, expiré, refusé ou mauvais type", async () => {
  const invalid = confirm({});
  for (const query of ["", "token_hash=hash&type=recovery", "error=access_denied&code=ignored"]) {
    const response = await invalid(new NextRequest(`https://yokkai.example/auth/confirm?${query}`));
    assert.equal(response.headers.get("location"), "https://yokkai.example/connexion?confirmation=erreur");
  }
  const expired = await confirm({ exchangeCodeForSession: async () => ({ error: { message: "expired" } }) })(
    new NextRequest("https://yokkai.example/auth/confirm?code=expired"),
  );
  assert.match(expired.headers.get("location"), /confirmation=erreur$/);
});

test("session : utilisateur vérifié par Auth et pseudo lu seulement pour son identifiant", async () => {
  let selectedId;
  const session = loadModule("../lib/auth/session.ts", {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "verified-id" } }, error: null }) },
      from: (table) => {
        assert.equal(table, "user_profiles");
        return { select: () => ({ eq: (column, id) => {
          assert.equal(column, "user_id"); selectedId = id;
          return { maybeSingle: async () => ({ data: { pseudo: "DB pseudo" }, error: null }) };
        } }) };
      },
    }) },
  });
  const user = await session.getCurrentUser();
  assert.equal(await session.getCurrentPseudo(user.id), "DB pseudo");
  assert.equal(selectedId, "verified-id");
});
