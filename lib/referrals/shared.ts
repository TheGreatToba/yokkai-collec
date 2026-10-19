export type ReferralStatus = {
  code: string | null;
  verifiedReferrals: number;
  packsEarned: number;
  bonusPacks: number;
};

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return /^[a-f0-9]{12}$/.test(code) ? code : null;
}
