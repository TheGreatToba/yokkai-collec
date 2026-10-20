import { YokaiCard, type YokaiCardProps } from "@/components/yokai-card";

export function AuthDecisionPreview({ cards }: { cards: YokaiCardProps[] }) {
  return (
    <div className="yk-auth-decision-preview">
      <div className="yk-auth-decision-heading">
        <div>
          <span className="yk-auth-feature-number">
            THE DAILY DECISION PACK
          </span>
          <h4>Which one will you choose?</h4>
          <p>Reveal five cards. Keep one. Turn the others into Karas.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/chrome-decision-booster-v1.png"
          alt="Decision Pack"
          width="952"
          height="1664"
          loading="lazy"
        />
      </div>
      <div className="yk-auth-decision-demo">
        <div className="yk-decision-banner">
          <p className="font-display text-karas">Choose your card</p>
          <p className="text-ink-2">
            Five possibilities. Only one joins your collection.
          </p>
        </div>
        <ol
          className="yk-reveal-grid"
          aria-label="Example Decision Pack reveal with five cards"
        >
          {cards.map((card, index) => (
            <li className="yk-reveal-slot" key={`${card.name}-${index}`}>
              <YokaiCard {...card} animated={false} />
            </li>
          ))}
        </ol>
      </div>
      <p className="yk-auth-decision-caption">
        <small>Illustrative reveal. Rarities vary.</small>
      </p>
    </div>
  );
}
