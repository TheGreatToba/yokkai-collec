export const PREMIUM_PLAN = {
  name: "Yokkai Pro",
  amount: 499,
  currency: "eur",
  interval: "month"
} as const;
export const PREMIUM_STYLES = ["aurora", "rose", "moonlight"] as const;
export type PremiumStyle = (typeof PREMIUM_STYLES)[number];
export type PremiumState = {
  configured: boolean;
  active: boolean;
  status: string;
  endsAt: number | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  style: PremiumStyle;
};
export const EMPTY_PREMIUM_STATE: PremiumState = {
  configured: false,
  active: false,
  status: "not_subscribed",
  endsAt: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  style: "aurora"
};

export function isLoopbackUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function localPremiumEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return (
    env.NODE_ENV === "development" &&
    env.LOCAL_PREMIUM_ENABLED === "true" &&
    isLoopbackUrl(env.NEXT_PUBLIC_SITE_URL) &&
    isLoopbackUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

export function premiumFromSubscriptions(
  subscriptions: {
    status: string;
    pause_collection?: unknown;
    cancel_at_period_end: boolean;
    items: { data: { price: { id: string }; current_period_end: number }[] };
  }[],
  priceId: string,
  now = Date.now()
) {
  const matching = subscriptions.filter(sub =>
    sub.items.data.some(item => item.price.id === priceId)
  );
  const active = matching.find(
    sub =>
      sub.status === "active" &&
      !sub.pause_collection &&
      sub.items.data.some(
        item =>
          item.price.id === priceId && item.current_period_end * 1000 > now
      )
  );
  const current = active ?? matching[0];
  return {
    active: !!active,
    status: current?.status ?? "not_subscribed",
    endsAt:
      current?.items.data.find(item => item.price.id === priceId)
        ?.current_period_end ?? null,
    cancelAtPeriodEnd: current?.cancel_at_period_end ?? false
  };
}
