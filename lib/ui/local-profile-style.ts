// Cosmetic choices for the local prototype only; never membership or achievement data.
export const NAME_FONTS = [
  {
    id: "modern",
    label: "Modern",
    family: "var(--font-sora), sans-serif",
    weight: 600
  },
  {
    id: "classic",
    label: "Classic",
    family: "var(--font-cinzel), Georgia, serif",
    weight: 600
  },
  {
    id: "rounded",
    label: "Rounded",
    family: '"Trebuchet MS", sans-serif',
    weight: 700
  },
  {
    id: "mono",
    label: "Mono",
    family: 'Consolas, "Courier New", monospace',
    weight: 700
  },
  {
    id: "bold",
    label: "Bold",
    family: 'Impact, "Arial Black", sans-serif',
    weight: 400
  },
  {
    id: "editorial",
    label: "Editorial",
    family: "Georgia, serif",
    weight: 700
  },
  {
    id: "script",
    label: "Script",
    family: '"Segoe Script", cursive',
    weight: 700
  },
  {
    id: "display",
    label: "Display",
    family: "var(--font-hy-wen-hei), Arial, sans-serif",
    weight: 700
  }
] as const;
export const NAME_EFFECTS = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "neon", label: "Neon" },
  { id: "outline", label: "Outline" },
  { id: "pop", label: "Pop" },
  { id: "shimmer", label: "Shimmer" },
  { id: "prism", label: "Prism" }
] as const;
export const NAME_COLORS = [
  { label: "Lavender", value: "#b69aff" },
  { label: "Rose", value: "#ff83bc" },
  { label: "Mint", value: "#75e5bd" },
  { label: "Sky", value: "#7ac9ff" },
  { label: "Gold", value: "#f3cb78" },
  { label: "Peach", value: "#ffb08d" },
  { label: "Pearl", value: "#eeebff" }
] as const;
export const STYLE_BADGES = [
  { id: "comet", label: "Comet", color: "#f3cb78" },
  { id: "bloom", label: "Bloom", color: "#ff83bc" },
  { id: "crystal", label: "Crystal", color: "#9ccaff" },
  { id: "orbit", label: "Orbit", color: "#b69aff" },
  { id: "flame", label: "Flame", color: "#ffb08d" },
  { id: "moon", label: "Moon", color: "#75e5bd" }
] as const;
export type StyleBadge = (typeof STYLE_BADGES)[number]["id"];
export type LocalProfileStyle = {
  font: (typeof NAME_FONTS)[number]["id"];
  effect: (typeof NAME_EFFECTS)[number]["id"];
  color: string;
  secondary: string;
  badges: StyleBadge[];
};
export const DEFAULT_LOCAL_PROFILE_STYLE: LocalProfileStyle = {
  font: "classic",
  effect: "solid",
  color: "#eeebff",
  secondary: "#b69aff",
  badges: []
};
export function normalizeLocalProfileStyle(
  input: LocalProfileStyle
): LocalProfileStyle {
  const hex = (value: string, fallback: string) =>
    /^#[a-f\d]{6}$/i.test(value) ? value : fallback;
  return {
    font: NAME_FONTS.some(font => font.id === input.font)
      ? input.font
      : "classic",
    effect: NAME_EFFECTS.some(effect => effect.id === input.effect)
      ? input.effect
      : "solid",
    color: hex(input.color, "#eeebff"),
    secondary: hex(input.secondary, "#b69aff"),
    badges: [...new Set(input.badges)]
      .filter(id => STYLE_BADGES.some(badge => badge.id === id))
      .slice(0, 3)
  };
}
export function localNameVariables(style: LocalProfileStyle) {
  const safe = normalizeLocalProfileStyle(style);
  const font = NAME_FONTS.find(font => font.id === safe.font)!;
  return {
    "--name-font": font.family,
    "--name-weight": font.weight,
    "--name-color": safe.color,
    "--name-secondary": safe.secondary
  };
}
export function randomLocalProfileStyle(
  random = Math.random
): LocalProfileStyle {
  const pick = <T>(values: readonly T[]) =>
    values[
      Math.min(
        values.length - 1,
        Math.max(0, Math.floor(random() * values.length))
      )
    ];
  return {
    font: pick(NAME_FONTS).id,
    effect: pick(NAME_EFFECTS).id,
    color: pick(NAME_COLORS).value,
    secondary: pick(NAME_COLORS).value,
    badges: [pick(STYLE_BADGES).id]
  };
}
