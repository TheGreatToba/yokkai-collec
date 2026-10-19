"use client";

import Link from "next/link";
import type { ProfileStyle } from "@/lib/ui/profile-style";
import {
  NAME_FONTS,
  NAME_EFFECTS,
  STYLE_BADGES,
  DEFAULT_PROFILE_STYLE
} from "@/lib/ui/profile-style";
import { useProAccess } from "@/components/pro-access";
import { StyledPlayerName } from "@/components/styled-player-name";

function hexToRgb(hex: string) {
  const value = /^#[a-f\d]{6}$/i.test(hex) ? hex.slice(1) : "000000";
  return [0, 2, 4].map(offset =>
    Number.parseInt(value.slice(offset, offset + 2), 16)
  );
}

function rgbToHex(values: number[]) {
  return `#${values
    .map(value =>
      Math.min(255, Math.max(0, Math.round(value)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function RgbColorControl({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const rgb = hexToRgb(value);
  return (
    <div className="yk-style-rgb-control">
      <div className="yk-style-rgb-heading">
        <span>{label}</span>
        <input
          type="color"
          value={value}
          aria-label={`${label} color picker`}
          onChange={event => onChange(event.target.value)}
        />
      </div>
      <div className="yk-style-rgb-values">
        {(["R", "G", "B"] as const).map((channel, index) => (
          <label key={channel}>
            <input
              type="number"
              min="0"
              max="255"
              inputMode="numeric"
              aria-label={`${label} ${channel}`}
              value={rgb[index]}
              onChange={event => {
                const next = [...rgb];
                next[index] = Number(event.target.value);
                onChange(rgbToHex(next));
              }}
            />
            <span>{channel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

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
      <div className="yk-style-embedded-heading">
        <h3 id="profile-style-heading">Profile style</h3>
        <span>{pro ? "PRO ACTIVE" : "PREVIEW ONLY"}</span>
      </div>
      {!pro && (
        <p className="yk-style-trial-note" role="status">
          Try every option and preview the result here. Your live profile stays
          unchanged until you upgrade to <Link href="/premium">Yokkai Pro</Link>
          .
        </p>
      )}
      <div className="yk-style-workspace">
        <fieldset disabled={busy} className="yk-style-embedded-fields">
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
              <p className="yk-style-help">
                Choose any RGB color for your name and its effects.
              </p>
              <div className="yk-style-custom-colors">
                <RgbColorControl
                  label="Primary"
                  value={value.color}
                  onChange={color => onChange({ ...value, color })}
                />
                <RgbColorControl
                  label="Accent"
                  value={value.secondary}
                  onChange={secondary => onChange({ ...value, secondary })}
                />
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
                      value.badges.length >= 3 &&
                      !value.badges.includes(badge.id)
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
        <aside className="yk-style-preview-column">
          <span className="yk-style-preview-eyebrow">LIVE PREVIEW</span>
          <div
            className="yk-style-profile-preview"
            aria-label="Profile style preview"
            aria-live="polite"
            data-profile-theme="default"
            data-avatar-frame={value.avatarFrame ?? "none"}
            data-showcase-effect={value.showcaseEffect ?? "none"}
          >
            <div className="yk-style-profile-preview-banner" aria-hidden="true">
              <span>✦</span>
            </div>
            <div className="yk-style-profile-preview-body">
              <div
                className="yk-style-profile-preview-avatar"
                aria-hidden="true"
              >
                <span>{name.slice(0, 1).toUpperCase()}</span>
              </div>
              <StyledPlayerName
                name={name}
                cosmetics={{ active: true, style: value }}
              />
              <p>Your style preview updates as you make changes.</p>
              <div
                className="yk-style-profile-preview-showcase"
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </div>
              <small>
                Your name style also appears in auction chat and wall posts.
              </small>
            </div>
          </div>
          <p className="yk-style-preview-note">
            Changes stay in this preview until you select Save &amp; apply.
          </p>
        </aside>
      </div>
    </section>
  );
}
