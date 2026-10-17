"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { Avatar, Button, Modal } from "@/components/ui";
import { LocalProProfileBadge } from "@/components/local-pro-badge-preview";
import { useLocalProfileStyle } from "@/components/local-profile-style-context";
import {
  DEFAULT_LOCAL_PROFILE_STYLE,
  NAME_COLORS,
  NAME_EFFECTS,
  NAME_FONTS,
  STYLE_BADGES,
  localNameVariables,
  randomLocalProfileStyle,
  type LocalProfileStyle,
  type StyleBadge
} from "@/lib/ui/local-profile-style";

function BadgeGlyph({ id }: { id: StyleBadge }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {id === "comet" && (
        <>
          <path d="m15 3 1.8 4.2L21 9l-4.2 1.8L15 15l-1.8-4.2L9 9l4.2-1.8L15 3Z" />
          <path d="m11 13-7 7m6-12-6 6m12 0-5 7" />
        </>
      )}
      {id === "bloom" && (
        <>
          <path d="M12 8c-7-8-11 1-5 4-6 3-2 12 5 4 7 8 11-1 5-4 6-3 2-12-5-4Z" />
          <circle cx="12" cy="12" r="2.2" />
        </>
      )}
      {id === "crystal" && (
        <>
          <path d="m12 2 8 8-8 12-8-12 8-8Zm-8 8h16M12 2l-3 8 3 12 3-12-3-8Z" />
        </>
      )}
      {id === "orbit" && (
        <>
          <circle cx="12" cy="12" r="6" />
          <ellipse
            cx="12"
            cy="12"
            rx="11"
            ry="4"
            transform="rotate(-35 12 12)"
          />
        </>
      )}
      {id === "flame" && (
        <path d="M13 2c1 7-5 6-5 12 0 2 1 3 2 4-1-4 3-4 3-7 5 4 5 9 0 11-11 0-13-9 0-20Z" />
      )}
      {id === "moon" && (
        <>
          <path d="M17 3A9 9 0 1 0 21 17 9 9 0 0 1 17 3Z" />
          <path d="m19 5 .8 2.2L22 8l-2.2.8L19 11l-.8-2.2L16 8l2.2-.8L19 5Z" />
        </>
      )}
    </svg>
  );
}

function CosmeticBadges({ badges }: { badges: StyleBadge[] }) {
  return (
    <div
      className="yk-style-badge-strip"
      aria-label="Decorative profile badges"
    >
      {badges.map(id => {
        const badge = STYLE_BADGES.find(badge => badge.id === id)!;
        return (
          <span
            key={id}
            className="yk-style-cosmetic-badge"
            style={{ "--badge-color": badge.color } as CSSProperties}
            role="img"
            aria-label={`${badge.label} style badge (local preview)`}
            title={`${badge.label} · Style badge`}
          >
            <BadgeGlyph id={id} />
          </span>
        );
      })}
    </div>
  );
}

export function LocalProfileCosmeticBadges({ isMe }: { isMe: boolean }) {
  const preview = useLocalProfileStyle();
  if (!isMe || !preview || !preview.style.badges.length) return null;
  return <CosmeticBadges badges={preview.style.badges} />;
}

type EditorProps = {
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isMe: boolean;
};

export function LocalProfileStyleEditor(props: EditorProps) {
  const preview = useLocalProfileStyle();
  const [open, setOpen] = useState(false);
  if (!preview || !props.isMe) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <span aria-hidden="true">✦ </span>Style profile
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Make your profile yours"
        className="yk-style-editor"
      >
        <StyleEditorContent
          {...props}
          initial={preview.style}
          onApply={style => {
            preview.apply(style);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function StyleEditorContent({
  name,
  avatarUrl,
  bannerUrl,
  initial,
  onApply,
  onCancel
}: EditorProps & {
  initial: LocalProfileStyle;
  onApply: (style: LocalProfileStyle) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<LocalProfileStyle>(() => ({
    ...initial,
    badges: [...initial.badges]
  }));
  const [bannerFailed, setBannerFailed] = useState(false);
  const variables = localNameVariables(draft) as CSSProperties;
  const edit = (patch: Partial<LocalProfileStyle>) =>
    setDraft(current => ({ ...current, ...patch }));
  const toggleBadge = (id: StyleBadge) =>
    edit({
      badges: draft.badges.includes(id)
        ? draft.badges.filter(badge => badge !== id)
        : [...draft.badges, id].slice(0, 3)
    });
  return (
    <>
      <div className="yk-style-editor-body">
        <div className="yk-style-controls">
          <p className="yk-style-intro">A new look. Still unmistakably you.</p>
          <fieldset>
            <legend>Choose your font</legend>
            <div className="yk-style-font-grid">
              {NAME_FONTS.map(font => (
                <button
                  type="button"
                  key={font.id}
                  data-font={font.id}
                  aria-pressed={draft.font === font.id}
                  onClick={() => edit({ font: font.id })}
                  className="yk-style-option"
                  style={{ fontFamily: font.family, fontWeight: font.weight }}
                >
                  <span aria-hidden="true">Aa</span>
                  <small>{font.label}</small>
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
                  data-effect={effect.id}
                  aria-pressed={draft.effect === effect.id}
                  onClick={() => edit({ effect: effect.id })}
                  className="yk-style-option"
                >
                  <span
                    className="yk-style-name"
                    data-name-effect={effect.id}
                    style={variables}
                  >
                    {effect.label}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Choose your colors</legend>
            <div className="yk-style-swatches">
              {NAME_COLORS.map(color => (
                <button
                  type="button"
                  key={color.label}
                  aria-label={color.label}
                  title={color.label}
                  aria-pressed={draft.color.toLowerCase() === color.value}
                  className="yk-style-swatch"
                  style={{ background: color.value }}
                  onClick={() => edit({ color: color.value })}
                />
              ))}
            </div>
            <div className="yk-style-custom-colors">
              <label>
                <input
                  type="color"
                  value={draft.color}
                  onChange={event => edit({ color: event.target.value })}
                />
                Primary
              </label>
              <label>
                <input
                  type="color"
                  value={draft.secondary}
                  onChange={event => edit({ secondary: event.target.value })}
                />
                Accent
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>
              Profile badges{" "}
              <span aria-live="polite">{draft.badges.length} / 3</span>
            </legend>
            <p className="yk-style-help">
              Pick up to three decorative badges. Your Pro badge stays beside
              your name.
            </p>
            <div className="yk-style-badge-grid">
              {STYLE_BADGES.map(badge => (
                <button
                  type="button"
                  key={badge.id}
                  data-badge={badge.id}
                  aria-pressed={draft.badges.includes(badge.id)}
                  disabled={
                    draft.badges.length >= 3 && !draft.badges.includes(badge.id)
                  }
                  onClick={() => toggleBadge(badge.id)}
                  className="yk-style-option"
                >
                  <span
                    className="yk-style-cosmetic-badge"
                    style={{ "--badge-color": badge.color } as CSSProperties}
                  >
                    <BadgeGlyph id={badge.id} />
                  </span>
                  <small>{badge.label}</small>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <aside className="yk-style-preview" aria-label="Live profile preview">
          <div className="yk-style-preview-caption">
            <span className="yk-style-live-dot" />
            LIVE PREVIEW
          </div>
          <article className="yk-style-profile-card">
            <div className="yk-style-preview-banner">
              {bannerUrl && !bannerFailed && (
                <Image
                  src={bannerUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 720px) 100vw, 400px"
                  onError={() => setBannerFailed(true)}
                />
              )}
              <span aria-hidden="true">✦</span>
            </div>
            <div className="yk-style-preview-identity">
              <Avatar name={name} image={avatarUrl ?? undefined} size={64} />
              <div className="yk-style-preview-name">
                <span
                  className="yk-style-name"
                  data-name-effect={draft.effect}
                  style={variables}
                >
                  {name}
                </span>
                <LocalProProfileBadge isMe={true} />
              </div>
              <CosmeticBadges badges={draft.badges} />
              <p>A little personality goes a long way.</p>
              <span className="yk-style-profile-label">YOKKAI COLLECTOR</span>
            </div>
          </article>
          <div className="yk-style-message-preview">
            <Avatar name={name} image={avatarUrl ?? undefined} size={30} />
            <div>
              <div className="yk-style-message-name">
                <span
                  className="yk-style-name"
                  data-name-effect={draft.effect}
                  style={variables}
                >
                  {name}
                </span>
                <LocalProProfileBadge isMe={true} />
                <time>12:34</time>
              </div>
              <p>Your next great pull starts here.</p>
            </div>
          </div>
          <p className="yk-style-preview-note">
            Style badges are decorative, not achievements or verified roles.
          </p>
        </aside>
      </div>
      <div className="yk-style-footer">
        <div>
          <button
            type="button"
            className="yk-style-reset"
            onClick={() =>
              setDraft({ ...DEFAULT_LOCAL_PROFILE_STYLE, badges: [] })
            }
          >
            Reset
          </button>
          <span>Local preview · Resets when you reload</span>
        </div>
        <div className="yk-style-footer-actions">
          <Button
            variant="secondary"
            onClick={() => setDraft(randomLocalProfileStyle())}
          >
            Surprise me
          </Button>
          <button type="button" className="yk-style-cancel" onClick={onCancel}>
            Cancel
          </button>
          <Button onClick={() => onApply(draft)}>Apply locally</Button>
        </div>
      </div>
    </>
  );
}
