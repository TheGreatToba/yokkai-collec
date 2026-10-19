import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("signup carries a bounded referral code and settings expose the referral panel", () => {
  const signup = readFileSync("app/(auth)/signup/page.tsx", "utf8");
  const form = readFileSync("components/auth-form.tsx", "utf8");
  const action = readFileSync("app/auth/actions.ts", "utf8");
  const settings = readFileSync("app/settings/page.tsx", "utf8");
  const panel = readFileSync("components/referral-panel.tsx", "utf8");
  assert.match(signup, /normalizeReferralCode/);
  assert.match(form, /name="referralCode"/);
  assert.match(action, /referral_code: referralCode/);
  assert.match(settings, /<ReferralPanel/);
  assert.match(panel, /verifies their email/);
  assert.match(panel, /5 bonus Regular Packs/);
});
