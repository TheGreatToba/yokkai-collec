"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  PROPOSED_PLAN_RULES,
  previewAvailability,
  type PreviewPlan
} from "@/lib/premium/offer";

export function PremiumPlanPreview() {
  const [plan, setPlan] = useState<PreviewPlan>("basic");
  const [minutes, setMinutes] = useState(0);
  const [auctions, setAuctions] = useState(0);
  const rules = PROPOSED_PLAN_RULES[plan];
  const ready = previewAvailability(plan, minutes);
  function choosePlan(next: PreviewPlan) {
    setPlan(next);
    setMinutes(0);
    setAuctions(0);
  }
  return (
    <section className="yk-pro-simulator" aria-labelledby="plan-preview-title">
      <div className="yk-pro-section-heading">
        <div>
          <p className="eyebrow">Try the difference</p>
          <h2 id="plan-preview-title">Your membership, in motion.</h2>
        </div>
        <div
          className="yk-pro-plan-toggle"
          role="group"
          aria-label="Simulated membership"
        >
          {(["basic", "pro"] as const).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={plan === key}
              onClick={() => choosePlan(key)}
            >
              {key === "pro" ? "Pro" : "Basic"}
            </button>
          ))}
        </div>
      </div>
      <p className="yk-premium-muted">
        Simulation only. These controls do not open packs, list cards, grant Pro
        access or change your account.
      </p>
      <div
        className="yk-pro-clock"
        role="group"
        aria-label="Simulated time since last pack"
      >
        {[0, 5, 10, 720, 1440].map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={minutes === value}
            onClick={() => setMinutes(value)}
          >
            {value === 0
              ? "Just opened"
              : value < 60
                ? `+${value} min`
                : `+${value / 60} h`}
          </button>
        ))}
      </div>
      <div className="yk-pro-sim-grid" aria-live="polite">
        <article>
          <span>Regular Pack</span>
          <strong>{rules.regularPackMinutes} min</strong>
          <p>
            {ready.regularReady ? "Next pack ready" : "Next pack not ready yet"}
          </p>
        </article>
        <article>
          <span>Decision Pack</span>
          <strong>{rules.decisionPackHours} h</strong>
          <p>
            {ready.decisionReady
              ? "Next Decision Pack ready"
              : "Next Decision Pack not ready yet"}
          </p>
        </article>
        <article>
          <span>Simulated active auctions</span>
          <strong>
            {auctions} / {rules.concurrentAuctions}
          </strong>
          <Button
            variant="secondary"
            disabled={auctions >= rules.concurrentAuctions}
            onClick={() =>
              setAuctions(count =>
                Math.min(count + 1, rules.concurrentAuctions)
              )
            }
          >
            {auctions >= rules.concurrentAuctions
              ? "Auction limit reached"
              : "Add a demo auction"}
          </Button>
          <button
            type="button"
            className="yk-premium-text-button"
            disabled={auctions === 0}
            onClick={() => setAuctions(0)}
          >
            Clear demo auctions
          </button>
        </article>
      </div>
      <div className="yk-pro-showcase-preview">
        <span>Showcase · {rules.showcaseSlots} characters</span>
        <div aria-label={`${rules.showcaseSlots} simulated showcase slots`}>
          {Array.from({ length: rules.showcaseSlots }, (_, index) => (
            <span key={index} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
