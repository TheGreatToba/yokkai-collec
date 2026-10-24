import { YokaiCard } from "@/components/yokai-card";
import { AuthCardCustomization } from "@/components/auth-card-customization";
import { AuthDecisionPreview } from "@/components/auth-decision-preview";
import { CardShell } from "@/components/card-shell";
import {
  AUTH_SHOWCASE_CARDS as cards,
  AUTH_MARQUEE_CARDS,
  AUTH_EVOLUTION_CARDS
} from "@/lib/auth/showcase-cards";

export function AuthShowcase() {
  return (
    <section className="yk-auth-showcase" aria-labelledby="auth-showcase-title">
      <div className="yk-auth-showcase-heading">
        <p className="eyebrow">A new discovery in every card</p>
        <h2 id="auth-showcase-title">
          Your favorites.
          <br />
          Your collection.
          <br />
          <em>Your next obsession.</em>
        </h2>
        <p>
          Open a pack. Find a favorite. From the first pull to the last missing
          card, there&apos;s always something worth collecting. With Pro, make
          your cards your own with custom images and animated GIFs.
        </p>
      </div>

      <div className="yk-auth-card-window">
        <div className="yk-auth-card-ribbon" aria-hidden="true">
          {[0, 1].map(copy => (
            <div className="yk-auth-card-set" key={copy}>
              {[...AUTH_MARQUEE_CARDS, ...AUTH_MARQUEE_CARDS].map(
                (card, index) => (
                  <div
                    className="yk-auth-display-card"
                    key={`${card.name}-${index}`}
                  >
                    <YokaiCard {...card} animated={false} />
                  </div>
                )
              )}
            </div>
          ))}
        </div>
        <p className="sr-only">
          Discover collectible cards:{" "}
          {AUTH_MARQUEE_CARDS.map(card => card.name).join(", ")}.
        </p>
      </div>

      <div className="yk-auth-feature-list">
        <AuthCardCustomization />
        <article className="yk-auth-feature yk-auth-feature-evolution">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">02 / THE EVOLUTION</span>
            <h3>Five copies. One evolution.</h3>
            <p>
              Got duplicates? Fuse five identical normal SSR cards into one SSR
              Evolved, or five identical normal LR cards into one LR Evolved.
              Same character. Same rarity. A new electric look.
            </p>
            <p>Shiny and already Evolved cards cannot be used for evolution.</p>
          </div>
          <div className="yk-auth-evolution-examples">
            {AUTH_EVOLUTION_CARDS.map(card => (
              <div
                className="yk-auth-evolution-preview"
                data-rarity={card.rarity}
                key={card.id}
              >
                <div className="yk-auth-evolution-heading">
                  <strong>{card.name}</strong>
                  <span>{card.rarity} evolution</span>
                </div>
                <div className="yk-auth-evolution-flow">
                  <figure className="yk-auth-evolution-card">
                    <figcaption>5 normal {card.rarity} copies</figcaption>
                    <div className="yk-auth-evolution-stack">
                      <CardShell interactive={false}>
                        <YokaiCard {...card} />
                        <span
                          className="yk-auth-evolution-count"
                          aria-hidden="true"
                        >
                          ×5
                        </span>
                      </CardShell>
                    </div>
                  </figure>
                  <span className="yk-auth-evolution-arrow" aria-hidden="true">
                    →
                  </span>
                  <figure className="yk-auth-evolution-card">
                    <figcaption>1 {card.rarity} Evolved</figcaption>
                    <CardShell interactive={false}>
                      <YokaiCard {...card} isEvolved />
                    </CardShell>
                  </figure>
                </div>
                <p>Same character. A new electric look.</p>
              </div>
            ))}
          </div>
        </article>

        <article className="yk-auth-feature yk-auth-feature-packs">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">03 / THE REVEAL</span>
            <h3>Small pack. Big possibilities.</h3>
            <p>
              Reveal five cards in every Regular Pack. Discover new characters,
              chase rare pulls, and find the ones you want to keep forever.
            </p>
            <span className="yk-auth-feature-tag">
              Five cards. One new story.
            </span>
          </div>
          <div className="yk-auth-pack-preview" aria-hidden="true">
            {/* Existing pack artwork is shared with the game. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/chrome-regular-booster-v1.png"
              alt=""
              width="952"
              height="1664"
            />
            <span>✦</span>
          </div>
          <AuthDecisionPreview cards={cards} />
        </article>

        <article className="yk-auth-feature">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">04 / THE COLLECTION</span>
            <h3>One more card. One step closer.</h3>
            <p>
              Build your albums by universe, track your progress, and spot the
              cards you&apos;re still missing. Every new find fills a little
              more of the page.
            </p>
          </div>
          <div
            className="yk-auth-album-preview"
            aria-label="Illustrative album preview, two of three cards collected"
          >
            <div className="yk-auth-preview-label">
              <span>Your album</span>
              <b>2 / 3</b>
            </div>
            <div className="yk-auth-album-cards" aria-hidden="true">
              {cards.slice(0, 2).map(card => (
                <YokaiCard key={card.name} {...card} animated={false} />
              ))}
              <div className="yk-auth-missing-card">
                <span>?</span>
              </div>
            </div>
            <div className="yk-auth-album-progress" aria-hidden="true">
              <span />
            </div>
            <p>The next piece is out there.</p>
          </div>
        </article>

        <article className="yk-auth-feature">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">
              05 / YOUR FAVORITE WORLDS
            </span>
            <h3>A binder for every obsession.</h3>
            <p>
              Your favorite manga. The series you can&apos;t stop watching. The
              cartoons you grew up with. Your favorite K-pop group. Complete
              their collections, track every missing card, and pin your favorite
              binders so they&apos;re always close.
            </p>
            <div className="yk-auth-binder-tags" aria-label="Binder categories">
              <span>Manga</span>
              <span>Series</span>
              <span>Cartoons</span>
              <span>K-pop</span>
            </div>
          </div>
          <div
            className="yk-auth-binder-preview"
            aria-label="Example favorite binders and collection progress"
          >
            <span className="yk-auth-preview-label">Your binders</span>
            <div className="yk-auth-binder-tile yk-auth-binder-favorite">
              <div>
                <strong>JUJUTSU KAISEN</strong>
                <span aria-hidden="true">★</span>
              </div>
              <p>
                <b>7</b> / 183 cards
              </p>
              <div className="yk-auth-binder-progress">
                <span style={{ width: "4%" }} />
              </div>
              <small>4% complete</small>
            </div>
            <div className="yk-auth-binder-tile yk-auth-binder-favorite">
              <div>
                <strong>GAME OF THRONES</strong>
                <span aria-hidden="true">★</span>
              </div>
              <p>
                <b>2</b> / 31 cards
              </p>
              <div className="yk-auth-binder-progress">
                <span style={{ width: "6%" }} />
              </div>
              <small>6% complete</small>
            </div>
            <div className="yk-auth-binder-tile yk-auth-binder-favorite">
              <div>
                <strong>KPOP</strong>
                <span aria-hidden="true">★</span>
              </div>
              <p>
                <b>3</b> / 127 cards
              </p>
              <div className="yk-auth-binder-progress">
                <span style={{ width: "2%" }} />
              </div>
              <small>2% complete</small>
            </div>
            <p className="yk-auth-preview-caption">
              Example binders. Every card brings you closer.
            </p>
          </div>
        </article>

        <article className="yk-auth-feature">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">06 / THE MARKET</span>
            <h3>Find your next great deal.</h3>
            <p>
              Put your cards up for auction or bid on a new favorite with Karas,
              the in-game currency. Keep an eye on the countdown.
            </p>
          </div>
          <div
            className="yk-auth-auction-preview"
            aria-label="Illustrative auction preview"
          >
            <YokaiCard {...cards[1]} animated={false} />
            <div>
              <span className="yk-auth-preview-label">Auction preview</span>
              <strong>{cards[1].name}</strong>
              <span className="yk-auth-auction-bid">
                <span aria-hidden="true">◆</span> 1,240 <small>Karas</small>
              </span>
              <div className="yk-auth-auction-clock">
                <span aria-hidden="true">◷</span> 02 : 14 : 09
              </div>
              <span className="yk-auth-preview-caption">
                The thrill of the final bid.
              </span>
            </div>
          </div>
        </article>

        <article className="yk-auth-feature yk-auth-feature-social">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">07 / THE COMMUNITY</span>
            <h3>Better finds. Better together.</h3>
            <p>
              Add friends, chat, and trade your duplicates for the cards you
              love. Your next missing card could be in a friend&apos;s
              collection.
            </p>
          </div>
          <div
            className="yk-auth-chat-preview"
            aria-label="Illustrative conversation and trade preview"
          >
            <p>Got a spare NEWJEANS?</p>
            <p>
              For your Luffy? <span aria-hidden="true">✦</span>
            </p>
            <div>
              <span aria-hidden="true">⇄</span> A new trade. A new favorite.
            </div>
          </div>
        </article>
      </div>
      <p className="yk-auth-showcase-signoff">
        Collect what you love. Make it yours.
      </p>
    </section>
  );
}
