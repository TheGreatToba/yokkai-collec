# M06 — Actual cutoff for expired manual Pro access

Fixes #389. The audit reproduction concerns the **Regular Pack** reserve,
despite the issue title mentioning Decision. Decision Packs now use the shared
daily quota (Basic 1, Pro 2, reset at 20:00 Europe/Paris), not an interval reserve.
This change does not alter those quotas, their history or their reset.

## Defect and correction

When an offline player's manual Pro grant expires, the old timing conversion
uses the next visit as the downgrade cutoff if there is no payment mirror.
In the reproduced case, an empty reserve at expiry, followed by twenty minutes
offline, incorrectly yields four Regular Packs instead of two.

`billing_sync_pack_timing` now takes the latest actual endpoint of overlapping
expired manual/eligible-payment entitlements, plus any explicit revocation
cutoff. An ineligible payment mirror cannot prolong the manual grant's timing.
If another entitlement remains valid, membership and timing remain Pro.

The manual-grant trigger preserves the old expiration when a grant is removed
or shortened. Renewing an expired grant reconciles its intervening Basic time
before enabling Pro again, preserving the existing grant-row then profile-row
lock order. Disabling/changing the payment scope provides its actual event time;
an older expired manual grant must not backdate this immediate revocation.

## Unchanged guarantees

- The same server-only function signatures, owners, ACLs and hardened empty
  `search_path` remain. No additional RPC, role, table or player access is added.
- Regular recharge stays Basic 600 seconds / Pro 300 seconds. Reserve caps stay
  Basic 5 / Pro 10; upgrades do not refill and downgrades cap timed credits at 5.
- Referral bonus credits, daily Decision history, pending choices and legacy
  Decision deadlines are not rewritten by timing conversion.
- The membership predicate, payment provider state and client behavior are
  unchanged. Browser/JWT flags cannot grant benefits.
- Installing the migration replaces functions only. It does not touch account
  rows, balances, grants or timers. Future syncs use the corrected cutoff; no
  retrospective confiscation or reconstruction of already-spent credits occurs.

## Coverage

The new disposable-database regression first reproduces the old four-pack result
on the full migration prefix, then applies only the candidate migration. It
checks function metadata and account/grant rows are unchanged by installation,
manual expiry, both overlap orders, ineligible mirrors, deletion and renewal of
expired grants, current revocation, Basic/Pro transitions, full reserve clamping,
remaining valid entitlements, scope/risk revocation, bonus/history preservation,
and denied player/table/column access. Existing assertions are not modified.

## Deployment

Migration: `20261021120000_manual_pro_expiry_timing.sql`.
Not applied on the VPS during preparation. Walid review and an exclusive
migration window are required before deployment. Apply with a validated backup,
the migration registry entry in the same transaction, and full schema-drift and
permission checks. Do not test by changing a real subscription or player's grant.
