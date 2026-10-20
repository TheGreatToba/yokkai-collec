"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { YokaiCard } from "@/components/yokai-card";
import { PREMIUM_CARD_ARTWORK_EXAMPLE as example } from "@/lib/premium/card-artwork-example";
import { AUTH_SHOWCASE_CARDS } from "@/lib/auth/showcase-cards";

function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotionPreference = () => true;

export function AuthCardCustomization() {
  const reducedMotion = useSyncExternalStore(
    subscribeMotionPreference,
    prefersReducedMotion,
    serverMotionPreference
  );

  return (
    <article className="yk-auth-feature yk-auth-feature-custom">
      <div className="yk-auth-feature-copy">
        <span className="yk-auth-feature-number">
          01 / YOUR CARDS, YOUR WAY
        </span>
        <h3>Same card. Your own style.</h3>
        <p>
          Your favorite scene. The perfect GIF. With Yokkai Pro, customize your
          cards with your own images and animated GIFs. Keep the character and
          rarity. Make the artwork yours.
        </p>
        <Link href="/premium" className="yk-auth-pro-link">
          <span aria-hidden="true">✦</span> Yokkai Pro{" "}
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="yk-auth-custom-preview">
        <div className="yk-auth-custom-pair">
          <figure>
            <figcaption>Original</figcaption>
            <YokaiCard {...AUTH_SHOWCASE_CARDS[0]} animated={false} />
          </figure>
          <span className="yk-auth-custom-arrow" aria-hidden="true">
            →
          </span>
          <figure>
            <figcaption>
              Your style <span>GIF</span>
            </figcaption>
            <YokaiCard
              {...AUTH_SHOWCASE_CARDS[0]}
              image={reducedMotion ? example.still : example.customGif}
              fallbackImage={example.still}
              animated={false}
            />
          </figure>
        </div>
        <p>Your image. Your GIF. Your signature.</p>
      </div>
    </article>
  );
}
