import "server-only";
import { localPremiumEnabled } from "./plan";
import { getPremiumState } from "./server";

// null means the local experiment is disabled: do not alter production rights.
export async function getLocalCardCustomizationAccess(
  userId: string
): Promise<boolean | null> {
  if (!localPremiumEnabled()) return null;
  try {
    const state = await getPremiumState(userId);
    return state.configured && state.active;
  } catch {
    return false;
  }
}
