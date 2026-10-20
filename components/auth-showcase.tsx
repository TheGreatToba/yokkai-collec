import { YokaiCard, type YokaiCardProps } from "@/components/yokai-card";
import { AuthCardCustomization } from "@/components/auth-card-customization";

const cards = [
  {
    name: "Satoru Gojou",
    rarity: "LR",
    shiny: true,
    category: "Anime/Manga",
    anime: "Jujutsu Kaisen",
    image: "/assets/landing/gojou.webp"
  },
  {
    name: "Levi",
    rarity: "SSR",
    category: "Anime/Manga",
    anime: "Attack on Titan",
    image: "/assets/landing/levi.webp"
  },
  {
    name: "Luffy Monkey",
    rarity: "LR",
    category: "Anime/Manga",
    anime: "One Piece",
    image: "/assets/landing/luffy.webp"
  }
] satisfies YokaiCardProps[];

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
              {[...cards, ...cards].map((card, index) => (
                <div
                  className="yk-auth-display-card"
                  key={`${card.name}-${index}`}
                >
                  <YokaiCard {...card} animated={false} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="sr-only">
          Discover collectible cards including Satoru Gojou from Jujutsu Kaisen,
          Levi from Attack on Titan, and Luffy Monkey from One Piece.
        </p>
      </div>

      <div className="yk-auth-feature-list">
        <AuthCardCustomization />
        <article className="yk-auth-feature yk-auth-feature-packs">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">02 / THE REVEAL</span>
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
            <div
              className="yk-auth-decision-cards"
              aria-label="Illustrative Decision Pack reveal with SSR and LR cards"
            >
              {[cards[0], cards[1], cards[2], cards[1], cards[0]].map(
                (card, index) => (
                  <div
                    className="yk-auth-decision-card"
                    key={`${card.name}-${index}`}
                  >
                    <YokaiCard {...card} animated={false} />
                  </div>
                )
              )}
            </div>
            <div className="yk-auth-decision-caption">
              <span>Five possibilities. One favorite.</span>
              <small>Illustrative reveal. Rarities vary.</small>
            </div>
          </div>
        </article>

        <article className="yk-auth-feature">
          <div className="yk-auth-feature-copy">
            <span className="yk-auth-feature-number">03 / THE COLLECTION</span>
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
            <span className="yk-auth-feature-number">04 / THE MARKET</span>
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
              <strong>Levi</strong>
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
            <span className="yk-auth-feature-number">05 / THE COMMUNITY</span>
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
            <p>Got a spare Levi?</p>
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
