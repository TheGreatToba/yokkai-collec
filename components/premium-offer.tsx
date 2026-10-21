import type { CSSProperties } from "react";
import Image from "next/image";
import type { BillingSettings } from "@/lib/billing/settings";
import { PremiumBannerPreview } from "@/components/premium-banner-preview";
import { PremiumCardArtworkPreview } from "@/components/premium-card-artwork-preview";
import { PremiumCheckout } from "@/components/premium-checkout";
import { PROPOSED_PLAN_RULES as rules } from "@/lib/premium/offer";

function PlanAvailability({ included }: { included: boolean }) {
  return (
    <span
      className={`yk-pro-plan-availability${included ? " is-included" : ""}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d={included ? "m5 12 4 4L19 6" : "M7 12h10"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">{included ? "Included" : "Not included"}</span>
    </span>
  );
}

export function PremiumOffer({
  signedIn,
  billing
}: {
  signedIn: boolean;
  billing: BillingSettings | null;
}) {
  return (
    <div
      className="yk-pro-offer"
      style={{ "--plus-accent": "var(--color-accent-neon)" } as CSSProperties}
    >
      <section className="yk-premium-hero yk-pro-offer-hero">
        <div className="yk-premium-copy">
          <p className="eyebrow">Yokkai Pro</p>
          <h1>
            More style.
            <br />
            <em>More cards.</em>
          </h1>
          <p className="yk-premium-intro">
            Open Regular Packs twice as often. Choose from two daily Decision
            Packs. Grow your collection faster, then make every favorite your
            own.
          </p>
          <div className="yk-pro-card-gains" aria-label="More packs with Pro">
            <div data-pack-kind="regular">
              <Image
                src="/assets/chrome-regular-booster-v1.png"
                alt="Regular Pack"
                width={72}
                height={128}
                sizes="64px"
                className="yk-pro-pack-image"
              />
              <div className="yk-pro-pack-copy">
                <strong>
                  {rules.basic.regularPackMinutes /
                    rules.pro.regularPackMinutes}
                  ×
                </strong>
                <span>as often</span>
                <p>1 pack every {rules.pro.regularPackMinutes} minutes.</p>
                <p>
                  Up to{" "}
                  <b>{60 / rules.pro.regularPackMinutes} packs per hour</b> when
                  opened regularly.
                </p>
              </div>
            </div>
            <div data-pack-kind="decision">
              <Image
                src="/assets/chrome-decision-booster-v1.png"
                alt="Decision Pack"
                width={72}
                height={128}
                sizes="64px"
                className="yk-pro-pack-image"
              />
              <div className="yk-pro-pack-copy">
                <strong>{rules.pro.decisionPacksPerDay}</strong>
                <span>every day</span>
                <p>
                  Decision Packs instead of {rules.basic.decisionPacksPerDay}.
                </p>
              </div>
            </div>
          </div>
          <a href="#plan-comparison" className="yk-premium-text-button">
            Compare Basic and Pro ↓
          </a>
        </div>
        <PremiumCheckout signedIn={signedIn} billing={billing} />
      </section>
      <div className="yk-pro-personalization-examples">
        <PremiumBannerPreview />
        <PremiumCardArtworkPreview />
      </div>
      <section
        id="plan-comparison"
        className="yk-pro-comparison"
        aria-labelledby="comparison-title"
      >
        <div className="yk-pro-comparison-heading">
          <p className="eyebrow">Basic vs Pro</p>
          <h2 id="comparison-title">Your collection, upgraded.</h2>
          <p>More cards to discover. More ways to make them yours.</p>
        </div>
        <div className="yk-pro-comparison-frame">
          <table>
            <caption className="sr-only">
              Basic and Pro membership comparison
            </caption>
            <thead>
              <tr>
                <th scope="col">What’s included</th>
                <th scope="col">
                  <span className="yk-pro-plan-name">Basic</span>
                  <span className="yk-pro-plan-description">
                    Free to collect
                  </span>
                </th>
                <th scope="col">
                  <span className="yk-pro-plan-name">
                    Yokkai Pro <span aria-hidden="true">✦</span>
                  </span>
                  <span className="yk-pro-plan-description">
                    More cards. More you.
                  </span>
                </th>
              </tr>
            </thead>
            <tbody aria-label="More cards">
              <tr className="yk-pro-comparison-group">
                <th colSpan={3} scope="rowgroup">
                  More cards
                </th>
              </tr>
              <tr>
                <th scope="row">Regular Pack</th>
                <td>Every {rules.basic.regularPackMinutes} min</td>
                <td>Every {rules.pro.regularPackMinutes} min</td>
              </tr>
              <tr>
                <th scope="row">Decision Pack</th>
                <td>{rules.basic.decisionPacksPerDay} per day</td>
                <td>{rules.pro.decisionPacksPerDay} per day</td>
              </tr>
              <tr>
                <th scope="row">Rarity odds per card</th>
                <td>Unchanged</td>
                <td>Unchanged</td>
              </tr>
            </tbody>
            <tbody aria-label="Make it yours">
              <tr className="yk-pro-comparison-group">
                <th colSpan={3} scope="rowgroup">
                  Make it yours
                </th>
              </tr>
              {[
                "Custom card artwork & GIFs",
                "Custom & animated banners",
                "Animated profile pictures",
                "Name colors & profile themes",
                "Avatar frames & decorative badges",
                "Showcase effects",
                "Pro badge"
              ].map(label => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>
                    <PlanAvailability included={false} />
                  </td>
                  <td>
                    <PlanAvailability included />
                  </td>
                </tr>
              ))}
            </tbody>
            <tbody aria-label="Collect and share">
              <tr className="yk-pro-comparison-group">
                <th colSpan={3} scope="rowgroup">
                  Collect & share
                </th>
              </tr>
              <tr>
                <th scope="row">Active auctions</th>
                <td>{rules.basic.concurrentAuctions}</td>
                <td>{rules.pro.concurrentAuctions}</td>
              </tr>
              <tr>
                <th scope="row">Showcase characters</th>
                <td>{rules.basic.showcaseSlots}</td>
                <td>{rules.pro.showcaseSlots}</td>
              </tr>
              <tr>
                <th scope="row">Binders & trading with friends</th>
                <td>
                  <PlanAvailability included />
                </td>
                <td>
                  <PlanAvailability included />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="yk-pro-offer-footnote">
          Decision Packs reset together every day at 8:00 PM Paris time,
          adjusting for daylight saving time. Both Pro packs are available at
          once. Unused packs do not carry over. Rarity odds per card stay the
          same for everyone.
        </p>
      </section>
      <section className="yk-premium-faq">
        <h2>A few things worth knowing.</h2>
        <details>
          <summary>Do rarity odds change with Pro?</summary>
          <p>
            No. Pro gives you faster Regular Packs and two daily Decision Packs
            instead of one. The rarity odds of each card stay the same.
          </p>
        </details>
        <details>
          <summary>Can I cancel my subscription?</summary>
          <p>
            Yes. Use Manage subscription to open the Stripe customer portal.
            Cancellation is set for the end of the current billing period.
          </p>
        </details>
        <details>
          <summary>Where do I manage my membership?</summary>
          <p>
            Open your account settings to view your membership, subscribe when
            payments are available, or manage an existing subscription.
          </p>
        </details>
      </section>
      <div className="yk-pro-offer-bottom">
        <p>More cards to collect. A collection that feels like you.</p>
        <a href="#membership" className="yk-button yk-button-primary">
          Get Yokkai Pro ↑
        </a>
      </div>
    </div>
  );
}
