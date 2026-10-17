import "server-only";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  EMPTY_PREMIUM_STATE,
  PREMIUM_PLAN,
  PREMIUM_STYLES,
  localPremiumEnabled,
  premiumFromSubscriptions,
  type PremiumStyle
} from "./plan";
import { billingTransaction, type BillingData } from "./store";

export class PremiumError extends Error {
  constructor(
    public code: string,
    public status = 400
  ) {
    super(code);
  }
}

export function requireLocalPremium() {
  if (!localPremiumEnabled()) throw new PremiumError("LOCAL_ONLY", 404);
}

export function stripeConfigured() {
  return (
    /^sk_test_[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY ?? "") &&
    /^price_[A-Za-z0-9]+$/.test(process.env.STRIPE_PREMIUM_PRICE_ID ?? "") &&
    !!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")
  );
}

function context() {
  requireLocalPremium();
  if (!stripeConfigured())
    throw new PremiumError("STRIPE_TEST_SETUP_REQUIRED", 503);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 1,
    timeout: 10_000
  });
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID!;
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin;
  const scope = createHash("sha256")
    .update(`${process.env.STRIPE_SECRET_KEY}:${priceId}`)
    .digest("hex")
    .slice(0, 24);
  return {
    stripe,
    priceId,
    origin,
    directory: join(process.cwd(), ".local-premium", scope),
    scope
  };
}

async function validatePrice(stripe: Stripe, priceId: string) {
  const price = await stripe.prices.retrieve(priceId);
  if (
    price.livemode ||
    !price.active ||
    price.unit_amount !== PREMIUM_PLAN.amount ||
    price.currency !== PREMIUM_PLAN.currency ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1 ||
    price.type !== "recurring" ||
    price.recurring.usage_type !== "licensed"
  )
    throw new PremiumError("PRICE_MUST_BE_EUR_499_MONTHLY", 503);
}

async function subscriptions(
  stripe: Stripe,
  customerId: string,
  priceId: string
) {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100
  });
  if (list.has_more || list.data.some(sub => sub.livemode))
    throw new PremiumError("SUBSCRIPTION_REVIEW_REQUIRED", 503);
  return { list: list.data, ...premiumFromSubscriptions(list.data, priceId) };
}

export async function getPremiumState(userId: string) {
  requireLocalPremium();
  if (!stripeConfigured()) return { ...EMPTY_PREMIUM_STATE };
  const { stripe, priceId, directory } = context();
  return billingTransaction(directory, async data => {
    const user = data.users[userId];
    if (!user) return { ...EMPTY_PREMIUM_STATE, configured: true };
    const state = await subscriptions(stripe, user.customerId, priceId);
    return {
      active: state.active,
      status: state.status,
      endsAt: state.endsAt,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      configured: true,
      hasCustomer: true,
      style: user.style ?? "aurora"
    };
  });
}

function checkoutUrl(url: string | null) {
  if (!url || new URL(url).origin !== "https://checkout.stripe.com")
    throw new PremiumError("CHECKOUT_UNAVAILABLE", 502);
  return url;
}

export async function createPremiumCheckout(userId: string) {
  const { stripe, priceId, origin, directory, scope } = context();
  await validatePrice(stripe, priceId);
  // Persist the customer before checkout. Stable idempotency also covers a
  // retry after a network error or before the mapping was written to disk.
  await billingTransaction(directory, async data => {
    if (!data.users[userId]) {
      const customer = await stripe.customers.create(
        { metadata: { yokkai_user_id: userId } },
        { idempotencyKey: `yokkai-local-customer:${scope}:${userId}` }
      );
      if (customer.livemode) throw new PremiumError("TEST_MODE_REQUIRED", 503);
      data.users[userId] = { customerId: customer.id };
    }
  });
  return billingTransaction(directory, async data => {
    const user = data.users[userId];
    const existing = await subscriptions(stripe, user.customerId, priceId);
    if (
      existing.list.some(
        sub => !["canceled", "incomplete_expired"].includes(sub.status)
      )
    )
      throw new PremiumError("USE_MANAGE_SUBSCRIPTION", 409);
    if (user.checkoutId) {
      const pending = await stripe.checkout.sessions.retrieve(user.checkoutId);
      if (pending.livemode) throw new PremiumError("TEST_MODE_REQUIRED", 503);
      if (pending.status === "open") return checkoutUrl(pending.url);
    }
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: user.customerId,
        client_reference_id: userId,
        line_items: [{ price: priceId, quantity: 1 }],
        allowed_payment_method_types: ["card"],
        subscription_data: { metadata: { yokkai_user_id: userId } },
        success_url: `${origin}/premium?checkout=returned`,
        cancel_url: `${origin}/premium?checkout=canceled`
      },
      {
        idempotencyKey: `yokkai-local-checkout:${scope}:${userId}:${user.checkoutId ?? "first"}`
      }
    );
    if (checkout.livemode) throw new PremiumError("TEST_MODE_REQUIRED", 503);
    const url = checkoutUrl(checkout.url);
    user.checkoutId = checkout.id;
    return url;
  });
}

export async function createPremiumPortal(userId: string) {
  const { stripe, directory, origin } = context();
  return billingTransaction(directory, async data => {
    const user = data.users[userId];
    if (!user) throw new PremiumError("NO_SUBSCRIPTION", 409);
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: `${origin}/premium`
    });
    if (new URL(portal.url).origin !== "https://billing.stripe.com")
      throw new PremiumError("PORTAL_UNAVAILABLE", 502);
    return portal.url;
  });
}

export async function savePremiumStyle(userId: string, style: unknown) {
  if (!PREMIUM_STYLES.includes(style as PremiumStyle))
    throw new PremiumError("INVALID_STYLE");
  const { stripe, priceId, directory } = context();
  return billingTransaction(directory, async data => {
    const user = data.users[userId];
    if (
      !user ||
      !(await subscriptions(stripe, user.customerId, priceId)).active
    )
      throw new PremiumError("PREMIUM_REQUIRED", 403);
    user.style = style as PremiumStyle;
  });
}

export async function applyPremiumEvent(
  event: Stripe.Event,
  stripe: Stripe,
  priceId: string,
  data: BillingData
) {
  if (event.livemode) throw new PremiumError("TEST_MODE_REQUIRED");
  if (data.events.includes(event.id)) return;
  const supported = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed"
  ];
  if (!supported.includes(event.type)) return;
  const object = event.data.object as unknown as {
    customer?: string | { id: string };
  };
  const customerId =
    typeof object.customer === "string" ? object.customer : object.customer?.id;
  const known = Object.values(data.users).find(
    user => user.customerId === customerId
  );
  // Never trust webhook metadata as the owner mapping. Read latest provider
  // state rather than applying a potentially stale event payload in order.
  if (known) await subscriptions(stripe, known.customerId, priceId);
  data.events.push(event.id);
  data.events = data.events.slice(-2000);
}

export async function receivePremiumWebhook(body: string, signature: string) {
  const { stripe, priceId, directory } = context();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
      300
    );
  } catch {
    throw new PremiumError("INVALID_SIGNATURE");
  }
  await billingTransaction(directory, data =>
    applyPremiumEvent(event, stripe, priceId, data)
  );
}
