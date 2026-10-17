"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { PREMIUM_BANNER_EXAMPLE as example } from "@/lib/premium/banner-example";
import { bannerGeometry } from "@/lib/ui/banner-frame";

function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotionPreference = () => true;

export function PremiumBannerPreview() {
  const reducedMotion = useSyncExternalStore(
    subscribeMotionPreference,
    prefersReducedMotion,
    serverMotionPreference
  );
  const [playbackOverride, setPlaybackOverride] = useState<boolean | null>(
    null
  );
  const [failed, setFailed] = useState(false);
  const playing = playbackOverride ?? !reducedMotion;
  const geometry = bannerGeometry(498 / 281, example.frame);
  return (
    <section
      className="yk-pro-banner-showcase"
      aria-labelledby="banner-preview-title"
    >
      <div className="yk-pro-banner-copy">
        <p className="eyebrow">Animated banners</p>
        <h2 id="banner-preview-title">
          Your profile.
          <br />
          <em>With a little motion.</em>
        </h2>
        <p>
          Your favorite moment, on repeat. Make your banner your own with an
          image or an animated GIF.
        </p>
        <div className="yk-pro-banner-caption">
          <span aria-hidden="true">✦</span> Featuring {example.name}
        </div>
        <p className="yk-pro-banner-disclaimer">
          A preview using BBDOU’s banner. No profile changes or Pro access are
          applied.
        </p>
      </div>
      <div className="yk-pro-banner-example">
        <div className="yk-pro-banner-card">
          <div
            className="yk-pro-live-banner"
            role="img"
            aria-label={`${example.name}'s ${playing ? "animated" : "still"} profile banner`}
          >
            <Image
              src={playing ? example.animated : example.still}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 600px) calc(100vw - 40px), 620px"
              className="yk-pro-banner-image"
              draggable={false}
              style={{
                transform: `translate(${geometry.offsetX}%, ${geometry.offsetY}%) scale(${geometry.scale}) rotate(${geometry.rotation}deg)`
              }}
              onError={() => setFailed(true)}
              onLoad={() => setFailed(false)}
            />
            {!failed && (
              <span className="yk-pro-gif-label" aria-hidden="true">
                {playing ? "GIF · PLAYING" : "STILL PREVIEW"}
              </span>
            )}
            {failed && (
              <span className="yk-pro-banner-error" role="status">
                Banner preview unavailable.
              </span>
            )}
          </div>
          <div className="yk-pro-banner-card-body">
            <Image
              src={example.avatar}
              alt={`${example.name}'s avatar`}
              width={78}
              height={78}
              className="yk-pro-banner-avatar"
            />
            <div className="yk-pro-banner-name">
              <h3>{example.name}</h3>
              <span>PRO STYLE PREVIEW</span>
            </div>
            <p>A banner that makes your profile feel alive.</p>
          </div>
        </div>
        <div className="yk-pro-banner-controls">
          <span>Original GIF · Same profile framing</span>
          <Button
            variant="secondary"
            aria-pressed={playing}
            onClick={() => setPlaybackOverride(!playing)}
          >
            {playing ? "Pause GIF" : "Play GIF"}
          </Button>
        </div>
      </div>
    </section>
  );
}
