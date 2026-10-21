export const PRO_PROMOTION_KEY = "yokkai:pro-promotion:v1:dismissed-at";
export const PRO_PROMOTION_SNOOZE = 7 * 24 * 60 * 60 * 1000;

export function proPromotionDismissed(
  value: string | null,
  now = Date.now()
): boolean {
  if (!value?.trim()) return false;
  const dismissedAt = Number(value);
  return (
    Number.isFinite(dismissedAt) &&
    dismissedAt > 0 &&
    dismissedAt <= now &&
    now - dismissedAt < PRO_PROMOTION_SNOOZE
  );
}
