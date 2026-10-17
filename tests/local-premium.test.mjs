import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import Stripe from "stripe";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const localEnv = {
  NODE_ENV: "development",
  LOCAL_PREMIUM_ENABLED: "true",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3001",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_PREMIUM_PRICE_ID: "price_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example"
};

function loader({ env = localEnv, cwd = root, stripe, extras = {} } = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute);
    const compiled = { exports: {} };
    cache.set(absolute, compiled.exports);
    const context = {
      module: compiled,
      exports: compiled.exports,
      process: { env, cwd: () => cwd },
      console: { error() {} },
      Buffer,
      URL,
      Response,
      Request,
      setTimeout,
      clearTimeout,
      require(name) {
        if (name === "server-only") return {};
        if (name === "stripe" && stripe)
          return class {
            constructor() {
              return stripe;
            }
          };
        if (name in extras) return extras[name];
        if (name.startsWith("./"))
          return load(resolve(absolute, "..", `${name}.ts`));
        if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
        return require(name);
      }
    };
    vm.runInNewContext(
      ts.transpileModule(readFileSync(absolute, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true
        }
      }).outputText,
      context,
      { filename: absolute }
    );
    return compiled.exports;
  }
  return load;
}
const plan = loader()("lib/premium/plan.ts");
function subscription(overrides = {}) {
  return {
    id: "sub_example",
    livemode: false,
    status: "active",
    pause_collection: null,
    cancel_at_period_end: false,
    items: {
      data: [{ price: { id: "price_example" }, current_period_end: 2000000000 }]
    },
    ...overrides
  };
}
function fakeStripe() {
  const calls = [];
  const state = {
    subs: [],
    price: {
      active: true,
      livemode: false,
      type: "recurring",
      unit_amount: 499,
      currency: "eur",
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "licensed"
      }
    },
    checkout: {
      id: "cs_test_example",
      livemode: false,
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_example"
    }
  };
  const real = new Stripe("sk_test_example");
  const stripe = {
    webhooks: real.webhooks,
    prices: {
      retrieve: async id => {
        calls.push(["price", id]);
        return state.price;
      }
    },
    customers: {
      create: async (params, options) => {
        calls.push(["customer", params, options]);
        return { id: "cus_example", livemode: false };
      }
    },
    subscriptions: {
      list: async params => {
        calls.push(["subscriptions", params]);
        return { has_more: false, data: state.subs };
      }
    },
    checkout: {
      sessions: {
        create: async (params, options) => {
          calls.push(["checkout", params, options]);
          return state.checkout;
        },
        retrieve: async id => {
          calls.push(["retrieve", id]);
          return state.checkout;
        }
      }
    },
    billingPortal: {
      sessions: {
        create: async params => {
          calls.push(["portal", params]);
          return { url: "https://billing.stripe.com/p/session/test" };
        }
      }
    }
  };
  return { stripe, state, calls };
}
async function fixture(t, env = localEnv) {
  const directory = await mkdtemp(join(tmpdir(), "yokkai-premium-unit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const mock = fakeStripe();
  const load = loader({ env, cwd: directory, stripe: mock.stripe });
  return { ...mock, load, api: load("lib/premium/server.ts"), directory };
}

test("local lab requires development, explicit opt-in and loopback app/database", () => {
  assert.equal(plan.localPremiumEnabled(localEnv), true);
  for (const change of [
    { NODE_ENV: "production" },
    { LOCAL_PREMIUM_ENABLED: "false" },
    { NEXT_PUBLIC_SITE_URL: "https://yokkai-collec.com" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://api.yokkai-collec.com" },
    { NEXT_PUBLIC_SITE_URL: "https://localhost.attacker.test" },
    { NEXT_PUBLIC_SITE_URL: "http://user:secret@localhost:3001" }
  ])
    assert.equal(plan.localPremiumEnabled({ ...localEnv, ...change }), false);
});
test("premium only accepts active unexpired subscriptions for the configured price", () => {
  assert.equal(
    plan.premiumFromSubscriptions(
      [subscription()],
      "price_example",
      1900000000000
    ).active,
    true
  );
  assert.equal(
    plan.premiumFromSubscriptions(
      [subscription({ cancel_at_period_end: true })],
      "price_example",
      1900000000000
    ).active,
    true
  );
  for (const status of [
    "past_due",
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "canceled",
    "paused",
    "trialing"
  ])
    assert.equal(
      plan.premiumFromSubscriptions(
        [subscription({ status })],
        "price_example",
        1900000000000
      ).active,
      false
    );
  assert.equal(
    plan.premiumFromSubscriptions(
      [subscription()],
      "price_other",
      1900000000000
    ).active,
    false
  );
  assert.equal(
    plan.premiumFromSubscriptions(
      [subscription()],
      "price_example",
      2100000000000
    ).active,
    false
  );
  assert.equal(
    plan.premiumFromSubscriptions(
      [subscription({ pause_collection: {} })],
      "price_example",
      1900000000000
    ).active,
    false
  );
});
test("missing setup and live keys never trigger Stripe requests", async t => {
  for (const key of [undefined, "sk_live_example", "rk_live_example"]) {
    const f = await fixture(t, { ...localEnv, STRIPE_SECRET_KEY: key });
    assert.equal(f.api.stripeConfigured(), false);
    assert.equal((await f.api.getPremiumState("user-a")).active, false);
    await assert.rejects(f.api.createPremiumCheckout("user-a"), {
      code: "STRIPE_TEST_SETUP_REQUIRED"
    });
    assert.equal(f.calls.length, 0);
  }
});
test("production and remote databases fail closed before Stripe or disk access", async t => {
  for (const env of [
    { ...localEnv, NODE_ENV: "production" },
    { ...localEnv, NEXT_PUBLIC_SUPABASE_URL: "https://api.yokkai-collec.com" }
  ]) {
    const f = await fixture(t, env);
    await assert.rejects(f.api.createPremiumCheckout("user-a"), {
      code: "LOCAL_ONLY",
      status: 404
    });
    await assert.rejects(f.api.getPremiumState("user-a"), {
      code: "LOCAL_ONLY"
    });
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await readdir(f.directory), []);
  }
});
test("Checkout uses server price, account mapping and stable idempotency; double clicks reuse the session", async t => {
  const f = await fixture(t);
  const urls = await Promise.all([
    f.api.createPremiumCheckout("user-a"),
    f.api.createPremiumCheckout("user-a")
  ]);
  assert.equal(urls[0], urls[1]);
  assert.equal(f.calls.filter(c => c[0] === "customer").length, 1);
  assert.equal(f.calls.filter(c => c[0] === "checkout").length, 1);
  const [, params, options] = f.calls.find(c => c[0] === "checkout");
  assert.equal(params.mode, "subscription");
  assert.equal(params.customer, "cus_example");
  assert.equal(params.client_reference_id, "user-a");
  assert.equal(params.line_items[0].price, "price_example");
  assert.equal(params.line_items[0].quantity, 1);
  assert.equal(
    params.success_url,
    "http://localhost:3001/premium?checkout=returned"
  );
  assert.match(options.idempotencyKey, /yokkai-local-checkout:/);
  assert.equal(
    (await f.api.getPremiumState("user-a")).active,
    false,
    "Checkout URL alone must not grant access"
  );
});
test("invalid Stripe prices cannot create a customer or Checkout", async t => {
  for (const change of [
    { unit_amount: 399 },
    { currency: "usd" },
    { livemode: true },
    { active: false },
    {
      recurring: { interval: "year", interval_count: 1, usage_type: "licensed" }
    }
  ]) {
    const f = await fixture(t);
    Object.assign(f.state.price, change);
    await assert.rejects(f.api.createPremiumCheckout("user-a"), {
      code: "PRICE_MUST_BE_EUR_499_MONTHLY"
    });
    assert.equal(
      f.calls.filter(c => ["customer", "checkout"].includes(c[0])).length,
      0
    );
  }
});
test("active, past-due and incomplete subscriptions prevent duplicate purchases", async t => {
  for (const status of ["active", "past_due", "incomplete"]) {
    const f = await fixture(t);
    f.state.subs = [subscription({ status })];
    await assert.rejects(f.api.createPremiumCheckout("user-a"), {
      code: "USE_MANAGE_SUBSCRIPTION"
    });
    assert.equal(f.calls.filter(c => c[0] === "checkout").length, 0);
  }
});
test("server studio saves require active provider state; cancellation revokes saving", async t => {
  const f = await fixture(t);
  await assert.rejects(f.api.savePremiumStyle("user-a", "rose"), {
    code: "PREMIUM_REQUIRED"
  });
  await f.api.createPremiumCheckout("user-a");
  f.state.subs = [subscription()];
  await f.api.savePremiumStyle("user-a", "rose");
  assert.equal((await f.api.getPremiumState("user-a")).style, "rose");
  await assert.rejects(
    f.api.savePremiumStyle("user-a", "javascript:alert(1)"),
    { code: "INVALID_STYLE" }
  );
  f.state.subs = [subscription({ status: "canceled" })];
  assert.equal((await f.api.getPremiumState("user-a")).active, false);
  await assert.rejects(f.api.savePremiumStyle("user-a", "moonlight"), {
    code: "PREMIUM_REQUIRED"
  });
  assert.equal((await f.api.getPremiumState("user-b")).hasCustomer, false);
});
test("portal uses only the authenticated account mapping", async t => {
  const f = await fixture(t);
  await assert.rejects(f.api.createPremiumPortal("user-b"), {
    code: "NO_SUBSCRIPTION"
  });
  await f.api.createPremiumCheckout("user-a");
  assert.match(
    await f.api.createPremiumPortal("user-a"),
    /^https:\/\/billing\.stripe\.com\//
  );
  assert.equal(f.calls.find(c => c[0] === "portal")[1].customer, "cus_example");
});
test("signed test webhooks are deduplicated and stale payloads never grant access", async t => {
  const f = await fixture(t);
  await f.api.createPremiumCheckout("user-a");
  const payload = JSON.stringify({
    id: "evt_test_one",
    type: "customer.subscription.updated",
    livemode: false,
    data: {
      object: {
        customer: "cus_example",
        status: "active",
        metadata: { yokkai_user_id: "user-b" }
      }
    }
  });
  const signature = f.stripe.webhooks.generateTestHeaderString({
    payload,
    secret: localEnv.STRIPE_WEBHOOK_SECRET
  });
  const before = f.calls.filter(c => c[0] === "subscriptions").length;
  await f.api.receivePremiumWebhook(payload, signature);
  await f.api.receivePremiumWebhook(payload, signature);
  assert.equal(
    f.calls.filter(c => c[0] === "subscriptions").length,
    before + 1
  );
  assert.equal((await f.api.getPremiumState("user-a")).active, false);
  assert.equal((await f.api.getPremiumState("user-b")).hasCustomer, false);
  await assert.rejects(f.api.receivePremiumWebhook(payload, "invalid"), {
    code: "INVALID_SIGNATURE"
  });
  const stale = f.stripe.webhooks.generateTestHeaderString({
    payload,
    secret: localEnv.STRIPE_WEBHOOK_SECRET,
    timestamp: Math.floor(Date.now() / 1000) - 1000
  });
  await assert.rejects(f.api.receivePremiumWebhook(payload, stale), {
    code: "INVALID_SIGNATURE"
  });
  const live = payload.replace('"livemode":false', '"livemode":true');
  const liveSignature = f.stripe.webhooks.generateTestHeaderString({
    payload: live,
    secret: localEnv.STRIPE_WEBHOOK_SECRET
  });
  await assert.rejects(f.api.receivePremiumWebhook(live, liveSignature), {
    code: "TEST_MODE_REQUIRED"
  });
});
test("local store serializes writes, persists across loaders and rolls back failed operations", async t => {
  const directory = await mkdtemp(join(tmpdir(), "yokkai-premium-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { billingTransaction } = loader()("lib/premium/store.ts");
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      billingTransaction(directory, async data => {
        data.events.push(`event-${i}`);
      })
    )
  );
  const saved = JSON.parse(
    await readFile(join(directory, "state.json"), "utf8")
  );
  assert.equal(new Set(saved.events).size, 8);
  await assert.rejects(
    billingTransaction(directory, async data => {
      data.events.push("failed");
      throw new Error("stop");
    }),
    /stop/
  );
  assert.equal(
    JSON.parse(await readFile(join(directory, "state.json"), "utf8")).events
      .length,
    8
  );
  assert.deepEqual(await readdir(directory), ["state.json"]);
});
test("HTTP mutations reject other origins, oversized input and browser-supplied identities", async () => {
  const api = loader({
    extras: {
      "@/lib/auth/session": {
        getCurrentUser: async () => ({ id: "verified-user" })
      }
    }
  })("lib/premium/http.ts");
  await assert.rejects(
    api.premiumUser(
      new Request("http://localhost:3001/api/premium/checkout", {
        headers: { origin: "https://evil.test" }
      })
    ),
    { code: "REQUEST_DENIED" }
  );
  for (const body of [
    '{"userId":"victim"}',
    '{"price":"price_other"}',
    "[]",
    "null",
    '"text"',
    "x".repeat(2048)
  ])
    await assert.rejects(
      api.premiumInput(
        new Request("http://localhost:3001", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body
        })
      ),
      { code: "INVALID_REQUEST" }
    );
  const anon = loader({
    extras: { "@/lib/auth/session": { getCurrentUser: async () => null } }
  })("lib/premium/http.ts");
  await assert.rejects(anon.premiumUser(), { code: "AUTH_REQUIRED" });
});
test("prototype has no production migrations or gameplay dependencies", () => {
  const source = readFileSync(join(root, "lib/premium/server.ts"), "utf8");
  assert.doesNotMatch(
    source,
    /SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|open_regular_pack|keep_decision_pack|credit_karas/
  );
  assert.match(source, /constructEvent\(\s*body,\s*signature,/);
  const page = readFileSync(join(root, "app/premium/page.tsx"), "utf8");
  assert.match(page, /if \(!localPremiumEnabled\(\)\) notFound\(\)/);
  const ui = readFileSync(
    join(root, "components/premium-experience.tsx"),
    "utf8"
  );
  assert.match(ui, /not a subscription/);
  assert.match(ui, /public profile is unchanged/);
  assert.doesNotMatch(ui, /sk_test_[A-Za-z0-9]{10}|sk_live_|localStorage/);
});
