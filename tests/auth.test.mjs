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
    "@/utils/supabase/server": { createClient: () => ({
      auth,
      rpc: auth.rpc ?? (async () => ({ data: true, error: null })),
    }) },
    "@/lib/auth/forms": forms,
  }, { process: { env } });
  return { ...loaded, revalidated };
}

test("dÃ©veloppement : l'inscription journalise le diagnostic Auth sans donnÃ©es personnelles", async () => {
  const calls = [];
  const loaded = loadModule("../app/auth/actions.ts", {
    "next/headers": { cookies: async () => ({}) },
    "next/navigation": { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath: () => {} },
    "@/utils/supabase/server": { createClient: () => ({ auth: {
      signUp: async () => ({ data: { user: null, session: null }, error: Object.assign(
        new Error("Database error for joueur@example.com"),
        { code: "unexpected_failure", status: 500 },
      ) }),
    }, rpc: async () => ({ data: true, error: null }) }) },
    "@/lib/auth/forms": forms,
  }, {
    process: { env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000", NODE_ENV: "development" } },
    console: { error: (...args) => calls.push(args) },
  });
  const result = await loaded.signUp({}, form());
  assert.match(result.error, /indisponible/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].code, "unexpected_failure");
  assert.equal(calls[0][1].status, 500);
  assert.equal(calls[0][1].message, "Database error for [email redacted]");
  assert.equal(JSON.stringify(calls).includes("joueur@example.com"), false);
  assert.equal(JSON.stringify(calls).includes("secret123"), false);
  assert.equal(JSON.stringify(calls).includes("Yokkai"), false);
});

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

test("réinitialisation : validation de l’email et confirmation identique", () => {
  const validPassword = "x".repeat(12);
  assert.match(forms.validateEmail(form({ email: "incorrect" })).error, /email valide/);
  assert.equal(forms.validateEmail(form({ email: "  joueur@example.com " })).email, "joueur@example.com");
  assert.equal(forms.validateNewPassword(form({ password: validPassword, confirmPassword: validPassword })).valid, true);
  const mismatch = forms.validateNewPassword(form({ password: "x".repeat(5), confirmPassword: "y".repeat(5) }));
  assert.match(mismatch.fields.password, /8 à 128/);
  assert.match(mismatch.fields.confirmPassword, /ne correspondent pas/);
});

test("paramètres : validation du mot de passe actuel et du nouveau", () => {
  const validPassword = "x".repeat(12);
  const missing = forms.validatePasswordChange(form({ currentPassword: "", password: validPassword, confirmPassword: validPassword }));
  assert.match(missing.fields.currentPassword, /actuel/);
  const identical = forms.validatePasswordChange(form({ currentPassword: validPassword, password: validPassword, confirmPassword: validPassword }));
  assert.match(identical.fields.password, /différent/);
});

test("réinitialisation : demande non énumérable et retour canonique", async () => {
  let sent;
  const api = actions({
    resetPasswordForEmail: async (email, options) => {
      sent = { email, options };
      return { error: { code: "user_not_found", status: 400 } };
    },
  });
  const result = await api.requestPasswordReset({}, form());
  assert.equal(result.success, true);
  assert.equal(sent.email, "joueur@example.com");
  assert.equal(sent.options.redirectTo, "https://yokkai.example/auth/confirm?next=/reinitialiser-mot-de-passe");
  assert.equal(JSON.stringify(result).includes("user_not_found"), false);
});

test("réinitialisation : changement authentifié, fermeture globale et retour connexion", async () => {
  const validPassword = "x".repeat(12);
  const calls = [];
  const api = actions({
    getUser: async () => ({ data: { user: { id: "verified-id" } }, error: null }),
    updateUser: async attributes => { calls.push(["update", attributes]); return { error: null }; },
    signOut: async options => { calls.push(["signout", options]); return { error: null }; },
  });
  await assert.rejects(
    api.updateRecoveredPassword({}, form({ password: validPassword, confirmPassword: validPassword })),
    /REDIRECT:\/connexion\?mot-de-passe=modifie/,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "update");
  assert.equal(calls[0][1].password, validPassword);
  assert.equal(calls[1][0], "signout");
  assert.equal(calls[1][1].scope, "global");
  assert.equal(api.revalidated.length, 1);
});

test("paramètres : le mot de passe actuel est revérifié avant modification", async () => {
  const currentPassword = "x".repeat(11);
  const nextPassword = "y".repeat(12);
  const calls = [];
  const api = actions({
    getUser: async () => ({ data: { user: { id: "verified-id", email: "joueur@example.com" } }, error: null }),
    signInWithPassword: async credentials => {
      calls.push(["verify", credentials]);
      return { data: { user: { id: "verified-id" } }, error: null };
    },
    updateUser: async attributes => { calls.push(["update", attributes]); return { error: null }; },
  });
  const result = await api.changePassword({}, form({ currentPassword, password: nextPassword, confirmPassword: nextPassword }));
  assert.equal(result.success, true);
  assert.equal(calls[0][1].email, "joueur@example.com");
  assert.equal(calls[0][1].password, currentPassword);
  assert.equal(calls[1][1].password, nextPassword);
  assert.equal(api.revalidated.length, 1);
});

test("paramètres : un mauvais mot de passe actuel ne permet aucune modification", async () => {
  let updates = 0;
  const api = actions({
    getUser: async () => ({ data: { user: { id: "verified-id", email: "joueur@example.com" } }, error: null }),
    signInWithPassword: async () => ({ data: { user: null }, error: { code: "invalid_credentials", status: 400 } }),
    updateUser: async () => { updates += 1; return { error: null }; },
  });
  const result = await api.changePassword({}, form({ currentPassword: "x".repeat(11), password: "y".repeat(12), confirmPassword: "y".repeat(12) }));
  assert.match(result.fields.currentPassword, /incorrect/);
  assert.equal(updates, 0);
});

test("inscription : règles du pseudo et comptage Unicode", () => {
  assert.match(forms.validateCredentials(form({ pseudo: "ab" }), true).fields.pseudo, /au moins 3/);
  assert.match(forms.validateCredentials(form({ pseudo: "a".repeat(31) }), true).fields.pseudo, /30 caractères maximum/);
  for (const pseudo of ["a/b", "a\\b", "a?b", "a#b", "a%b", "a<b", "a>b", "a\u0007b"]) {
    assert.match(forms.validateCredentials(form({ pseudo }), true).fields.pseudo, /ne peut pas contenir/);
  }
  for (const pseudo of [" Émi ", "Yōkai 👺", "😀".repeat(30)]) {
    assert.equal(forms.validateCredentials(form({ pseudo }), true).fields.pseudo, undefined);
  }
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

test("inscription : un pseudo pris est refusé avant tout appel Auth", async () => {
  let authCalls = 0;
  const api = actions({
    rpc: async (name, params) => {
      assert.equal(name, "is_pseudo_available");
      assert.equal(params.p_pseudo, "KITSUNE");
      return { data: false, error: null };
    },
    signUp: async () => { authCalls += 1; },
  });
  const result = await api.signUp({}, form({ pseudo: "  KITSUNE  " }));
  assert.equal(result.fields.pseudo, "Ce pseudo est déjà pris, essaie-en un autre.");
  assert.equal(authCalls, 0);
});

test("inscription : la collision arrivée entre la vérification et Auth est reconnue", async () => {
  let checks = 0;
  const api = actions({
    rpc: async () => ({ data: ++checks === 1, error: null }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: { code: "unexpected_failure", status: 500, message: "Database error saving new user" },
    }),
  });
  const result = await api.signUp({}, form({ pseudo: "Kitsune" }));
  assert.equal(checks, 2);
  assert.equal(result.fields.pseudo, "Ce pseudo est déjà pris, essaie-en un autre.");
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
  for (const code of ["invalid_credentials", "email_not_confirmed", "user_banned", "over_request_rate_limit", "unexpected_failure"]) {
    const result = await actions({ signInWithPassword: async () => ({ error: { code, message: "SECRET PROVIDER DETAILS" } }) }).signIn({}, form());
    assert.ok(result.error);
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.equal(JSON.stringify(result).includes("secret123"), false);
  }
  const result = await actions({ signUp: async () => { throw new Error("network"); } }).signUp({}, form());
  assert.match(result.error, /indisponible/);
});

test("inscription : chaque erreur Auth identifiable a un message distinct", () => {
  const expected = new Map([
    ["user_banned", /Votre compte est banni\./],
    ["weak_password", /mot de passe est trop faible/],
    ["email_exists", /déjà utilisée/],
    ["user_already_exists", /déjà utilisée/],
    ["over_request_rate_limit", /Trop de tentatives/],
    ["over_email_send_rate_limit", /Trop de tentatives/],
    ["email_address_invalid", /n’est pas valide/],
    ["email_address_not_authorized", /n’est pas autorisée/],
    ["signup_disabled", /inscriptions sont temporairement désactivées/],
    ["email_provider_disabled", /inscriptions sont temporairement désactivées/],
    ["unexpected_failure", /momentanément indisponible/],
    ["request_timeout", /momentanément indisponible/],
  ]);
  for (const [code, message] of expected) assert.match(forms.authError(code), message);
  assert.match(forms.authError("validation_failed", 400), /demande d’authentification a été refusée/);
  assert.match(forms.authError(undefined, 0), /momentanément indisponible/);
  assert.match(forms.authError(undefined, 503), /momentanément indisponible/);
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
  const api = actions({ rpc: async name => { assert.equal(name,"mark_offline"); return {data:null,error:null}; }, signOut: async ({ scope }) => { assert.equal(scope, "local"); return { error: null }; } });
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

test("confirmation : lien absent, expiré ou refusé", async () => {
  const invalid = confirm({});
  for (const query of ["", "error=access_denied&code=ignored"]) {
    const response = await invalid(new NextRequest(`https://yokkai.example/auth/confirm?${query}`));
    assert.equal(response.headers.get("location"), "https://yokkai.example/connexion?confirmation=erreur");
  }
  const expired = await confirm({ exchangeCodeForSession: async () => ({ error: { message: "expired" } }) })(
    new NextRequest("https://yokkai.example/auth/confirm?code=expired"),
  );
  assert.match(expired.headers.get("location"), /confirmation=erreur$/);
});

test("confirmation : récupération par code ou token vers la page de nouveau mot de passe", async () => {
  const handler = confirm({
    exchangeCodeForSession: async () => ({ error: null }),
    verifyOtp: async input => {
      assert.equal(input.type, "recovery");
      return { error: null };
    },
  });
  for (const query of [
    "code=valid&next=/reinitialiser-mot-de-passe",
    "token_hash=hash&type=recovery",
  ]) {
    const response = await handler(new NextRequest(`https://yokkai.example/auth/confirm?${query}`));
    assert.equal(response.headers.get("location"), "https://yokkai.example/reinitialiser-mot-de-passe");
  }
});

test("session : utilisateur vérifié par Auth et pseudo lu via RPC sans identifiant", async () => {
  const calls = [];
  const session = loadModule("../lib/auth/session.ts", {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/headers": { cookies: async () => ({}) },
    "@/utils/supabase/server": { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "verified-id" } }, error: null }) },
      rpc: async (...args) => { calls.push(args); return { data: { user: { name: "DB pseudo" } }, error: null }; },
    }) },
  });
  const user = await session.getCurrentUser();
  assert.equal(await session.getCurrentPseudo(user.id), "DB pseudo");
  assert.equal(user.id, "verified-id");
  assert.equal(await session.getCurrentPseudo("someone-else"), "DB pseudo");
  assert.deepEqual(calls, [["get_game_info"], ["get_game_info"]]);
});
