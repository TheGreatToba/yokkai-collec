import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = file => readFileSync(resolve(root, file), "utf8");
const compiled = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source("lib/premium/checkout-link.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { exports: compiled.exports, module: compiled, URL }
);
const { stripePaymentDestination } = compiled.exports;

test("payment links only allow the expected Stripe host with no credentials", () => {
  assert.equal(
    stripePaymentDestination(
      "https://checkout.stripe.com/c/pay/cs_test_example",
      "checkout"
    ),
    "https://checkout.stripe.com/c/pay/cs_test_example"
  );
  assert.equal(
    stripePaymentDestination(
      "https://billing.stripe.com/p/session/example",
      "portal"
    ),
    "https://billing.stripe.com/p/session/example"
  );
  for (const url of [
    undefined,
    null,
    {},
    7,
    "",
    "/premium?active=true",
    "javascript:alert(1)",
    "http://checkout.stripe.com/c/pay/example",
    "https://checkout.stripe.com.evil.test/pay",
    "https://user@checkout.stripe.com/pay",
    "https://user:secret@billing.stripe.com/p/session/",
    "https://evil.test"
  ]) {
    assert.throws(() => stripePaymentDestination(url, "checkout"));
    assert.throws(() => stripePaymentDestination(url, "portal"));
  }
  assert.throws(() =>
    stripePaymentDestination(
      "https://billing.stripe.com/p/session/example",
      "checkout"
    )
  );
  assert.throws(() =>
    stripePaymentDestination("https://checkout.stripe.com/pay", "portal")
  );
});

test("the routed Pro page shows the offer and checkout, with no interactive lab", () => {
  const page = source("app/premium/page.tsx");
  const offer = source("components/premium-offer.tsx");
  const checkout = source("components/premium-checkout.tsx");
  assert.match(page, /<PremiumOffer/);
  assert.doesNotMatch(page, /PremiumExperience|premium-experience/);
  assert.match(page, /if \(!localPremiumEnabled\(\)\) notFound\(\)/);
  assert.match(offer, /<PremiumCheckout/);
  assert.match(offer, /<PremiumBannerPreview/);
  assert.match(offer, /features\.map/);
  assert.match(offer, /className="yk-pro-comparison"/);
  for (const ui of [offer, checkout]) {
    assert.doesNotMatch(
      ui,
      /Try the interactive|Activate demo|Save studio|Rose quartz|Moonlight|PremiumExperience|PremiumPlanPreview|premium\/style|Modal|localStorage/
    );
  }
  assert.match(checkout, /PREMIUM_PLAN.amount \/ 100/);
  assert.match(checkout, /Subscribe —/);
  assert.match(checkout, /Sign in to subscribe/);
  assert.match(checkout, /!state.configured/);
  assert.match(checkout, /submitting.current/);
  assert.match(checkout, /body: "\{\}"/);
  assert.match(
    checkout,
    /window.location.assign\(stripePaymentDestination\(result.url, kind\)\)/
  );
  assert.doesNotMatch(
    checkout,
    /setState\([^)]*active:\s*true|searchParams|URLSearchParams/
  );
});

test("commercial copy keeps availability honest without demo annotations", () => {
  const offer = source("components/premium-offer.tsx");
  const artwork = source("components/premium-card-artwork-preview.tsx");
  const page = source("app/premium/page.tsx");
  assert.match(offer, /COMING SOON/);
  assert.match(offer, /not available yet/);
  assert.match(offer, /Subscriptions will open once/);
  assert.match(artwork, /Your collection, reimagined/);
  assert.doesNotMatch(artwork, /Artwork example only/);
  assert.doesNotMatch(page, /Local preview/);
  assert.match(page, /if \(!localPremiumEnabled\(\)\) notFound\(\)/);
});
