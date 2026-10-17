"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Button, Modal } from "@/components/ui";
import { PremiumPlanPreview } from "@/components/premium-plan-preview";
import {
  PROPOSED_PLAN_RULES,
  PROPOSED_PRO_FEATURES
} from "@/lib/premium/offer";
import {
  EMPTY_PREMIUM_STATE,
  PREMIUM_STYLES,
  type PremiumState,
  type PremiumStyle
} from "@/lib/premium/plan";

const looks: Record<
  PremiumStyle,
  { name: string; accent: string; description: string }
> = {
  aurora: {
    name: "Aurora",
    accent: "#b69aff",
    description: "A soft violet glow. A little otherworldly."
  },
  rose: {
    name: "Rose quartz",
    accent: "#f6a1c9",
    description: "Pearlescent pink, made for the spotlight."
  },
  moonlight: {
    name: "Moonlight",
    accent: "#a0d9ef",
    description: "Cool silver-blue. Quietly unmistakable."
  }
};
const benefits = [
  [
    "01",
    "A profile that feels like you",
    "Custom artwork, animated banners, exclusive frames and a Pro badge."
  ],
  [
    "02",
    "More room for your collection",
    "A 10-character showcase, six auction slots and extra achievements."
  ],
  [
    "03",
    "Your next pack, sooner",
    "Regular Packs every 5 minutes. Decision Packs every 12 hours. Same rarity odds."
  ]
];

export function PremiumExperience({
  signedIn,
  name
}: {
  signedIn: boolean;
  name: string;
}) {
  const [state, setState] = useState<PremiumState>(EMPTY_PREMIUM_STATE);
  const [style, setStyle] = useState<PremiumStyle>("aurora");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(signedIn);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [demoMember, setDemoMember] = useState(false);
  const [setup, setSetup] = useState(false);
  const look = looks[style];
  const enabled = state.active || demoMember;

  async function refresh() {
    setError("");
    try {
      const response = await fetch("/api/premium/status", {
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data);
      setStyle(data.style);
      return data as PremiumState;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't refresh your subscription."
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/premium/status", {
          cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) {
          setState(data);
          setStyle(data.style);
        }
      } catch {
        if (!cancelled)
          setError(
            "Couldn't load your test subscription. You can still use the preview."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  async function openStripe(kind: "checkout" | "portal") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/premium/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const destination = new URL(result.url);
      if (
        destination.origin !==
        (kind === "checkout"
          ? "https://checkout.stripe.com"
          : "https://billing.stripe.com")
      )
        throw new Error("Invalid payment destination.");
      window.location.assign(destination.href);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't open Stripe."
      );
      setBusy(false);
    }
  }
  async function saveStyle() {
    if (demoMember && !state.active) {
      setNotice(
        "Demo style applied to this preview only. Your real profile is unchanged."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/premium/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(
        "Style saved in the local Pro studio. Your public profile is unchanged."
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't save your style."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ "--plus-accent": look.accent } as CSSProperties}>
      <div className="yk-premium-test-note">
        <span>TEST MODE</span> This is a local subscription lab. No real money
        is charged.
      </div>
      <section className="yk-premium-hero">
        <div className="yk-premium-copy">
          <p className="eyebrow">A little more you.</p>
          <h1>
            Make it
            <br />
            <em>unmistakably yours.</em>
          </h1>
          <p className="yk-premium-intro">
            Your favorite characters. Your own signature. Meet{" "}
            <strong>Yokkai Pro</strong> — more ways to personalize, collect and
            make your corner of Yokkai feel like home.
          </p>
          <div className="yk-premium-tags">
            <span>Make it your own</span>
            <span>Faster packs, unchanged rarity odds</span>
          </div>
          <div className="yk-premium-hero-actions">
            <a href="#membership" className="yk-button yk-button-primary">
              Explore Pro <span aria-hidden="true">↘</span>
            </a>
            <button
              type="button"
              className="yk-premium-text-button"
              onClick={() => setDemo(true)}
            >
              Try the interactive demo →
            </button>
          </div>
        </div>
        <div
          className="yk-premium-visual"
          aria-label="Interactive profile style preview"
        >
          <div className="yk-premium-orbit" aria-hidden="true" />
          <div className={`yk-premium-profile ${enabled ? "is-plus" : ""}`}>
            <div className="yk-premium-banner">
              <span>YOUR NEXT CHAPTER</span>
              <span aria-hidden="true">✧</span>
            </div>
            <div className="yk-premium-profile-body">
              <div className="yk-premium-avatar">
                {name.slice(0, 1).toUpperCase()}
                <span aria-hidden="true">✦</span>
              </div>
              <div className="yk-premium-identity">
                <h2>{name}</h2>
                <span className="yk-premium-badge">✦ PRO</span>
              </div>
              <p>
                Collect what you love.
                <br />
                Make the rest your own.
              </p>
              <div className="yk-premium-mini-cards" aria-hidden="true">
                <div />
                <div />
                <div />
              </div>
              <span className="yk-premium-preview-label">
                STYLE PREVIEW · {look.name.toUpperCase()}
              </span>
            </div>
          </div>
          <span className="yk-premium-floating-note">
            A new kind of rare.
            <br />
            <strong>Entirely you.</strong>
          </span>
        </div>
      </section>
      <section className="yk-premium-benefits" aria-label="Membership benefits">
        {benefits.map(([number, title, description]) => (
          <article key={number}>
            <span>{number} /</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <section className="yk-pro-comparison" aria-labelledby="comparison-title">
        <p className="eyebrow">The proposed membership</p>
        <h2 id="comparison-title">Basic or Pro. Your way to collect.</h2>
        <p className="yk-premium-muted">
          Planned rules for this local prototype, not current account
          entitlements. No free features have been removed.
        </p>
        <table>
          <caption className="sr-only">
            Proposed Basic and Pro plan limits
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
              <td>Every {PROPOSED_PLAN_RULES.basic.regularPackMinutes} min</td>
              <td>Every {PROPOSED_PLAN_RULES.pro.regularPackMinutes} min</td>
            </tr>
            <tr>
              <th scope="row">Decision Pack</th>
              <td>Every {PROPOSED_PLAN_RULES.basic.decisionPackHours} h</td>
              <td>Every {PROPOSED_PLAN_RULES.pro.decisionPackHours} h</td>
            </tr>
            <tr>
              <th scope="row">Active auctions</th>
              <td>{PROPOSED_PLAN_RULES.basic.concurrentAuctions}</td>
              <td>{PROPOSED_PLAN_RULES.pro.concurrentAuctions}</td>
            </tr>
            <tr>
              <th scope="row">Showcase characters</th>
              <td>{PROPOSED_PLAN_RULES.basic.showcaseSlots}</td>
              <td>{PROPOSED_PLAN_RULES.pro.showcaseSlots}</td>
            </tr>
            <tr>
              <th scope="row">Rarity odds per card</th>
              <td>Unchanged</td>
              <td>Unchanged</td>
            </tr>
          </tbody>
        </table>
        <p className="yk-premium-muted">
          Two Decision Packs per day means a 12-hour cooldown, not two packs
          banked at once.
        </p>
      </section>
      <PremiumPlanPreview />
      <section
        className="yk-pro-feature-section"
        aria-labelledby="pro-features-title"
      >
        <p className="eyebrow">All the details</p>
        <h2 id="pro-features-title">Everything planned for Pro.</h2>
        <p className="yk-premium-muted">
          Offer preview only. The features below are not yet connected to public
          profiles or game rules.
        </p>
        <div className="yk-pro-feature-grid">
          {PROPOSED_PRO_FEATURES.map(feature => (
            <article key={feature.id}>
              <span>PLANNED</span>
              <h3>{feature.title}</h3>
              <p>{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="yk-premium-studio" aria-labelledby="studio-title">
        <div>
          <p className="eyebrow">Find your signature</p>
          <h2 id="studio-title">Three moods. Your choice.</h2>
          <p>{look.description}</p>
          <p className="yk-premium-muted">
            Prototype styles are shown above. Saving stays in this local studio;
            public profiles are not modified.
          </p>
        </div>
        <div className="yk-premium-style-controls">
          <div role="group" aria-label="Profile theme">
            {PREMIUM_STYLES.map(key => (
              <button
                type="button"
                key={key}
                aria-pressed={style === key}
                onClick={() => {
                  setStyle(key);
                  setNotice("");
                }}
                className="yk-premium-swatch"
                style={{ "--swatch": looks[key].accent } as CSSProperties}
              >
                <span aria-hidden="true" />
                {looks[key].name}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            disabled={!enabled || busy}
            onClick={saveStyle}
          >
            {enabled ? "Save studio style" : "Join Pro or try the demo to save"}
          </Button>
        </div>
      </section>
      <section className="yk-premium-membership" id="membership">
        <div>
          <p className="eyebrow">One membership. All your personality.</p>
          <h2>
            Your collection is unique.
            <br />
            Your profile can be, too.
          </h2>
          <p>
            Start with a monthly plan. Keep the looks you love while your
            subscription is active. The proposed offer adds faster packs, more
            auction slots and a bigger showcase alongside personalization.
          </p>
          <ul>
            <li>Regular Packs every 5 minutes</li>
            <li>Decision Packs every 12 hours</li>
            <li>6 active auctions and 10 showcase characters</li>
            <li>Custom artwork, GIFs, themes, frames and effects</li>
            <li>
              Extra achievements that reward Karas; objectives and amounts to be
              defined
            </li>
          </ul>
          <p className="yk-premium-muted">
            These are prototype benefits for local evaluation, not a live
            commercial offer. Even an active Stripe test subscription only
            unlocks style saving in this studio, not the planned game benefits.
          </p>
        </div>
        <article className="yk-premium-price-card">
          <div className="yk-premium-plan-heading">
            <h3>
              Yokkai <em>Pro</em>
            </h3>
            <span>MONTHLY</span>
          </div>
          <p className="yk-premium-price">
            €4.99 <span>/ month</span>
          </p>
          <p>Test subscription · EUR · Renews monthly until canceled.</p>
          <div className="yk-premium-current-state">
            <span className="yk-premium-status-dot" />
            {loading
              ? "Checking local subscription…"
              : state.active
                ? "Stripe test subscription active"
                : demoMember
                  ? "Interactive demo active — not a subscription"
                  : state.hasCustomer
                    ? `Test subscription: ${state.status.replaceAll("_", " ")}`
                    : "Your own little upgrade."}
          </div>
          {state.endsAt && (
            <p>
              {state.cancelAtPeriodEnd ? "Access ends" : "Current period ends"}{" "}
              {new Date(state.endsAt * 1000).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric"
              })}
              .
            </p>
          )}
          {!signedIn ? (
            <Link href="/login" className="yk-button yk-button-primary">
              Sign in for Stripe test checkout
            </Link>
          ) : state.configured ? (
            <Button
              disabled={busy || loading}
              onClick={() =>
                openStripe(state.hasCustomer ? "portal" : "checkout")
              }
            >
              {busy
                ? "Opening Stripe…"
                : state.hasCustomer
                  ? "Manage subscription"
                  : "Subscribe in Stripe test mode →"}
            </Button>
          ) : (
            <Button disabled={loading} onClick={() => setSetup(true)}>
              Set up Stripe test checkout
            </Button>
          )}
          {signedIn &&
            state.configured &&
            state.hasCustomer &&
            !state.active && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => openStripe("checkout")}
              >
                Start or resume test checkout
              </Button>
            )}
          <button
            className="yk-premium-text-button"
            type="button"
            onClick={() => setDemo(true)}
          >
            Preview without a payment card
          </button>
          {signedIn && (
            <button
              className="yk-premium-text-button"
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Refresh subscription status
            </button>
          )}
          <p className="yk-premium-checkout-note">
            Hosted checkout by Stripe. Manage payment details, invoices and
            cancellation in the Stripe customer portal.
          </p>
        </article>
      </section>
      <div aria-live="polite" className="yk-premium-notices">
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="yk-premium-error">
            {error}
          </p>
        )}
      </div>
      <section className="yk-premium-faq">
        <h2>A few things worth knowing.</h2>
        <details>
          <summary>Does Pro change rarity odds?</summary>
          <p>
            No. The proposed offer shortens pack cooldowns, so Pro members can
            open more packs over time, but rarity odds per card stay the same.
            This local preview does not change any real pack cooldowns or
            rewards.
          </p>
        </details>
        <details>
          <summary>Can I cancel?</summary>
          <p>
            Yes. Once a Stripe test subscription exists, use Manage
            subscription. Configure cancellation at the end of the paid period
            in the Stripe portal.
          </p>
        </details>
        <details>
          <summary>Is this charging real money?</summary>
          <p>
            No. This lab only runs in development with a local database and
            Stripe test keys. Live keys are rejected. The interactive demo does
            not contact Stripe or activate a real subscription.
          </p>
        </details>
        <details>
          <summary>Will this change my public profile?</summary>
          <p>
            Not yet. This first prototype saves the chosen theme in the local
            Pro studio only. Integrating the final cosmetics into public
            profiles is a separate step.
          </p>
        </details>
      </section>
      <Modal open={demo} onClose={() => setDemo(false)} title="Try Yokkai Pro">
        <div className="yk-premium-demo">
          <span className="yk-premium-badge">INTERACTIVE DEMO</span>
          <h3>Your style. No checkout needed.</h3>
          <p>
            Enable a temporary Pro preview on this page. No bank card, no Stripe
            account, no subscription and no changes to your real profile.
          </p>
          <Button
            onClick={() => {
              setDemoMember(true);
              setDemo(false);
              setNotice(
                "Demo activated. Choose a theme and save it in the preview. Nothing is charged."
              );
            }}
          >
            Activate demo preview
          </Button>
          {demoMember && (
            <Button
              variant="secondary"
              onClick={() => {
                setDemoMember(false);
                setDemo(false);
                setNotice(
                  "Demo reset. No subscription was canceled or created."
                );
              }}
            >
              Reset demo
            </Button>
          )}
        </div>
      </Modal>
      <Modal
        open={setup}
        onClose={() => setSetup(false)}
        title="Connect Stripe test mode"
      >
        <div className="yk-premium-demo">
          <p>
            Add these server-side settings to the local environment, then
            restart the development server:
          </p>
          <code>
            STRIPE_SECRET_KEY=sk_test_…
            <br />
            STRIPE_PREMIUM_PRICE_ID=price_…
            <br />
            STRIPE_WEBHOOK_SECRET=whsec_…
          </code>
          <p>
            Create a recurring test price of €4.99 per month in EUR. Forward
            Stripe events to <code>/api/premium/webhook</code> using Stripe CLI.
          </p>
          <p>
            Never paste secret keys into this chat, the browser or source
            control. Live keys are not accepted by this prototype.
          </p>
          <Button
            onClick={() => {
              setSetup(false);
              setDemo(true);
            }}
          >
            Try the demo instead
          </Button>
        </div>
      </Modal>
    </div>
  );
}
