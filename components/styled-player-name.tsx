import type { CSSProperties } from "react";
import {
  DEFAULT_PROFILE_STYLE,
  normalizeProfileStyle,
  nameStyleVariables,
  STYLE_BADGES,
  type ProfileStyle
} from "@/lib/ui/profile-style";

export type PlayerCosmetics = { active: boolean; style: Partial<ProfileStyle> };
export function StyledPlayerName({
  name,
  cosmetics,
  fallbackLabel
}: {
  name: string;
  cosmetics?: PlayerCosmetics;
  fallbackLabel?: string;
}) {
  if (!cosmetics?.active) return <>{fallbackLabel ?? name}</>;
  const style = normalizeProfileStyle({
    ...DEFAULT_PROFILE_STYLE,
    ...cosmetics.style
  });
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className="yk-style-name"
        data-name-effect={style.effect}
        style={nameStyleVariables(style) as CSSProperties}
      >
        {fallbackLabel ?? name}
      </span>
      <span
        className="yk-profile-pro-badge"
        role="img"
        aria-label="Yokkai Pro"
        title="Yokkai Pro"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="m12 2 2.9 7.1L22 12l-7.1 2.9L12 22l-2.9-7.1L2 12l7.1-2.9Z" />
        </svg>
      </span>
      {style.badges.map(badge => (
        <span
          key={badge}
          className="yk-style-cosmetic-badge"
          role="img"
          aria-label={`${badge} decorative badge`}
          title={badge}
          style={
            {
              "--badge-color": STYLE_BADGES.find(item => item.id === badge)
                ?.color
            } as CSSProperties
          }
        >
          {
            {
              comet: "☄",
              bloom: "✿",
              crystal: "◆",
              orbit: "◎",
              flame: "♨",
              moon: "☾"
            }[badge]
          }
        </span>
      ))}
    </span>
  );
}
