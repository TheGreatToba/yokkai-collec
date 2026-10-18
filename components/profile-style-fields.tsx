"use client";

import type { ProfileStyle } from "@/lib/ui/profile-style";
import {
  NAME_FONTS,
  NAME_EFFECTS,
  STYLE_BADGES,
  DEFAULT_PROFILE_STYLE
} from "@/lib/ui/profile-style";
import { useProAccess, ProFeatureNotice } from "@/components/pro-access";
import { StyledPlayerName } from "@/components/styled-player-name";

export function ProfileStyleFields({
  value,
  onChange,
  busy,
  name
}: {
  value: ProfileStyle;
  onChange: (value: ProfileStyle) => void;
  busy: boolean;
  name: string;
}) {
  const pro = useProAccess();
  return (
    <section
      className="yk-style-embedded"
      aria-labelledby="profile-style-heading"
    >
      <h3 id="profile-style-heading">Profile style · Pro</h3>
      {!pro && <ProFeatureNotice feature="Profile styling" />}
      <fieldset disabled={!pro || busy} className="yk-style-embedded-fields">
        <legend className="sr-only">Profile style settings</legend>
        <div className="yk-style-controls">
          <fieldset>
            <legend>Choose your font</legend>
            <div className="yk-style-font-grid">
              {NAME_FONTS.map(font => (
                <button
                  type="button"
                  key={font.id}
                  className="yk-style-option"
                  aria-pressed={value.font === font.id}
                  style={{ fontFamily: font.family }}
                  onClick={() => onChange({ ...value, font: font.id })}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Choose your effect</legend>
            <div className="yk-style-effect-grid">
              {NAME_EFFECTS.map(effect => (
                <button
                  type="button"
                  key={effect.id}
                  className="yk-style-option"
                  aria-pressed={value.effect === effect.id}
                  onClick={() => onChange({ ...value, effect: effect.id })}
                >
                  {effect.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Name colors</legend>
            <div className="yk-style-custom-colors">
              <label>
                Primary{" "}
                <input
                  type="color"
                  value={value.color}
                  onChange={e => onChange({ ...value, color: e.target.value })}
                />
              </label>
              <label>
                Accent{" "}
                <input
                  type="color"
                  value={value.secondary}
                  onChange={e =>
                    onChange({ ...value, secondary: e.target.value })
                  }
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Decorative badges · {value.badges.length}/3</legend>
            <div className="yk-style-badge-grid">
              {STYLE_BADGES.map(badge => (
                <button
                  type="button"
                  key={badge.id}
                  className="yk-style-option"
                  aria-pressed={value.badges.includes(badge.id)}
                  disabled={
                    value.badges.length >= 3 && !value.badges.includes(badge.id)
                  }
                  onClick={() =>
                    onChange({
                      ...value,
                      badges: value.badges.includes(badge.id)
                        ? value.badges.filter(id => id !== badge.id)
                        : [...value.badges, badge.id]
                    })
                  }
                >
                  {badge.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Profile theme{" "}
            <select
              className="auth-input"
              value={value.theme ?? "default"}
              onChange={e =>
                onChange({
                  ...value,
                  theme: e.target.value as ProfileStyle["theme"]
                })
              }
            >
              {["default", "amethyst", "midnight", "rose", "ocean"].map(
                option => (
                  <option key={option}>{option}</option>
                )
              )}
            </select>
          </label>
          <label>
            Avatar frame{" "}
            <select
              className="auth-input"
              value={value.avatarFrame ?? "none"}
              onChange={e =>
                onChange({
                  ...value,
                  avatarFrame: e.target.value as ProfileStyle["avatarFrame"]
                })
              }
            >
              {["none", "orbit", "crystal", "bloom", "flame"].map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Showcase effect{" "}
            <select
              className="auth-input"
              value={value.showcaseEffect ?? "none"}
              onChange={e =>
                onChange({
                  ...value,
                  showcaseEffect: e.target
                    .value as ProfileStyle["showcaseEffect"]
                })
              }
            >
              {["none", "glow", "sparkle", "prism"].map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="yk-style-reset"
            onClick={() => onChange({ ...DEFAULT_PROFILE_STYLE, badges: [] })}
          >
            Reset style
          </button>
        </div>
      </fieldset>
      <div
        className="mt-6 rounded-panel border border-veil p-5"
        aria-label="Profile style preview"
      >
        <StyledPlayerName
          name={name}
          cosmetics={{ active: pro, style: value }}
        />
        <p className="mt-3 text-xs text-ink-3">
          Your name style also appears in auction chat and wall posts.
        </p>
      </div>
    </section>
  );
}
