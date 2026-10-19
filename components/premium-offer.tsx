import type { CSSProperties } from "react";
import type { BillingSettings } from "@/lib/billing/settings";
import { PremiumBannerPreview } from "@/components/premium-banner-preview";
import { PremiumCardArtworkPreview } from "@/components/premium-card-artwork-preview";
import { PremiumCheckout } from "@/components/premium-checkout";
import {
  PROPOSED_PLAN_RULES as rules,
  PROPOSED_PRO_FEATURES as features
} from "@/lib/premium/offer";

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
      style={{ "--plus-accent": "#b69aff" } as CSSProperties}
    >
      <section className="yk-premium-hero yk-pro-offer-hero">
        <div className="yk-premium-copy">
          <p className="eyebrow">Yokkai Pro</p>
          <h1>
            More style.
            <br />
            <em>More possibilities.</em>
          </h1>
          <p className="yk-premium-intro">
            Make Yokkai your own. Personalize your profile and cards, open packs
            more often and give your collection more room to shine.
          </p>
          <div className="yk-premium-tags">
            <span>Regular Packs every 5 minutes</span>
            <span>Two Decision Packs per day</span>
            <span>Your own signature style</span>
          </div>
          <a href="#pro-benefits" className="yk-premium-text-button">
            See all Pro benefits ↓
          </a>
        </div>
        <PremiumCheckout signedIn={signedIn} billing={billing} />
      </section>
      <section className="yk-pro-comparison" aria-labelledby="comparison-title">
        <p className="eyebrow">A little more room to collect</p>
        <h2 id="comparison-title">Basic or Pro. Your way to collect.</h2>
        <table>
          <caption className="sr-only">
            Basic and Pro membership comparison
          </caption>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Basic</th>
              <th scope="col">Pro</th>
            </tr>
          </thead>
          <tbody>
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
              <th scope="row">Rarity odds per card</th>
              <td>Unchanged</td>
              <td>Unchanged</td>
            </tr>
          </tbody>
        </table>
        <p className="yk-pro-offer-footnote">
          Decision Packs reset together every day at 8:00 PM Paris time,
          adjusting for daylight saving time. Both Pro packs are available at
          once. Unused packs do not carry over. Rarity odds per card stay the
          same for everyone.
        </p>
      </section>
      <div className="yk-pro-personalization-examples">
        <PremiumBannerPreview />
        <PremiumCardArtworkPreview />
      </div>
      <section
        id="pro-benefits"
        className="yk-pro-feature-section"
        aria-labelledby="pro-benefits-title"
      >
        <p className="eyebrow">One membership. All your personality.</p>
        <h2 id="pro-benefits-title">Everything in Pro.</h2>
        <div className="yk-pro-feature-grid">
          {features.map(feature => (
            <article key={feature.id}>
              {feature.id === "achievements" && <span>Coming soon</span>}
              <h3>{feature.title}</h3>
              <p>{feature.detail}</p>
            </article>
          ))}
        </div>
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
        <p>Make your next chapter your own.</p>
        <a href="#membership" className="yk-button yk-button-primary">
          Get Yokkai Pro ↑
        </a>
      </div>
    </div>
  );
}
