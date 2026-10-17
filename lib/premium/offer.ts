// Proposed product rules for the isolated local preview, NOT game entitlements.
// Real privileges must be enforced by authenticated database functions, not this file.
export const PROPOSED_PLAN_RULES = {
  basic: {
    regularPackMinutes: 10,
    decisionPackHours: 24,
    concurrentAuctions: 3,
    showcaseSlots: 5
  },
  pro: {
    regularPackMinutes: 5,
    decisionPackHours: 12,
    concurrentAuctions: 6,
    showcaseSlots: 10
  }
} as const;
export type PreviewPlan = keyof typeof PROPOSED_PLAN_RULES;

export const PROPOSED_PRO_FEATURES = [
  {
    id: "card-art",
    title: "Custom card artwork",
    detail: "Use artwork from Imgur or Pinterest."
  },
  {
    id: "regular-packs",
    title: "Faster Regular Packs",
    detail: "One pack every 5 minutes instead of 10."
  },
  {
    id: "decision-packs",
    title: "Two Decision Packs per day",
    detail: "One every 12 hours instead of 24. They do not stack."
  },
  {
    id: "auctions",
    title: "More auction slots",
    detail: "List up to 6 cards at once instead of 3."
  },
  {
    id: "achievements",
    title: "Additional achievements and Karas",
    detail:
      "Unlock extra Pro achievements that reward Karas. Objectives and Karas amounts are still to be defined."
  },
  {
    id: "site-background",
    title: "Your own site background",
    detail: "Customize the atmosphere across Yokkai."
  },
  {
    id: "banners",
    title: "Custom and animated banners",
    detail: "Upload your own images or GIFs for your profile banner."
  },
  {
    id: "avatar-gifs",
    title: "Animated profile pictures",
    detail: "Bring your avatar to life with a GIF."
  },
  {
    id: "showcase",
    title: "A bigger showcase",
    detail: "Show off 10 characters instead of 5."
  },
  {
    id: "pro-badge",
    title: "A Pro badge",
    detail: "Show your membership next to your name."
  },
  {
    id: "frames",
    title: "Exclusive avatar frames and badges",
    detail: "Add a signature finishing touch to your identity."
  },
  {
    id: "profile-themes",
    title: "Name colors and profile themes",
    detail: "Give your profile a coordinated look."
  },
  {
    id: "showcase-effects",
    title: "Showcase effects and card backs",
    detail: "Style your showcase and personalize your card backs."
  }
] as const;

export function previewAvailability(plan: PreviewPlan, elapsedMinutes: number) {
  const rules = PROPOSED_PLAN_RULES[plan];
  const elapsed = Number.isFinite(elapsedMinutes)
    ? Math.max(0, elapsedMinutes)
    : 0;
  return {
    regularReady: elapsed >= rules.regularPackMinutes,
    decisionReady: elapsed >= rules.decisionPackHours * 60
  };
}
