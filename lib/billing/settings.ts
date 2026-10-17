import "server-only";
import { billingConfig, BillingError } from "./config";
import { configuredBillingService } from "./server";
import type { SubscriptionState } from "./subscription";

export type BillingStatus = SubscriptionState & { hasCustomer: boolean };
export type BillingSettings = {
  enabled: boolean;
  checkoutEnabled: boolean;
  sandbox: boolean;
  status: BillingStatus | null;
  unavailable: boolean;
};

// Only safe presentation data crosses the server/client boundary.
export async function getBillingSettings(
  userId: string
): Promise<BillingSettings> {
  const result: BillingSettings = {
    enabled: false,
    checkoutEnabled: false,
    sandbox: false,
    status: null,
    unavailable: false
  };
  try {
    const config = billingConfig();
    result.enabled = true;
    result.checkoutEnabled = config.checkoutEnabled;
    result.sandbox = !config.live;
    result.status = await configuredBillingService().status(userId);
  } catch (error) {
    result.unavailable = !(
      error instanceof BillingError && error.code === "BILLING_DISABLED"
    );
  }
  return result;
}
