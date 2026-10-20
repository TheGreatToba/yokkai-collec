import Link from "next/link";
import { YokaiCard } from "@/components/yokai-card";
import { AUTH_MARQUEE_CARDS } from "@/lib/auth/showcase-cards";
import "@/styles/home.css";

export function HomeHero() {
  return (
    <section className="yk-home-hero" aria-labelledby="home-title">
      <div className="yk-home-hero-copy">
        <p className="eyebrow">A new discovery in every card</p>
        <h1 id="home-title">
          Your favorites.
          <br />
          Your collection.
          <br />
          <em>Your next obsession.</em>
        </h1>
        <p>
          Open packs and discover your next favorite.
          <br />
          Collect cards and complete your binders.
          <br />
          Trade with friends and sell at auction.
        </p>
        <Link href="/boosters" className="yk-button yk-button-primary">
          Open a booster <span aria-hidden="true">↗</span>
        </Link>
        <label className="yk-home-motion-control">
          <input type="checkbox" />
          Pause animation
        </label>
      </div>
      <div className="yk-home-ribbon-window" aria-hidden="true">
        <div className="yk-home-ribbon">
          {[0, 1].map(copy => (
            <div className="yk-home-ribbon-set" key={copy}>
              {AUTH_MARQUEE_CARDS.map(card => (
                <div className="yk-home-display-card" key={card.id}>
                  <YokaiCard {...card} animated={false} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeLinks({ discordEnabled }: { discordEnabled: boolean }) {
  return (
    <>
      {discordEnabled && (
        <section aria-labelledby="home-discord" className="yk-home-discord">
          <div>
            <p className="eyebrow">Better together</p>
            <h2 id="home-discord">Join the Yokkai community</h2>
            <p>
              Share your pulls, find trading partners, and meet fellow
              collectors.
            </p>
          </div>
          <Link href="/discord" className="yk-button yk-button-secondary">
            Join Discord ↗
          </Link>
        </section>
      )}
      <section aria-labelledby="home-learn" className="yk-home-panel">
        <h2 id="home-learn">Learn more</h2>
        <div className="yk-home-guides">
          {[
            ["/rules", "The rules", "Everything you need to start collecting."],
            [
              "/rarities",
              "Rarities & shiny cards",
              "Get to know the cards worth chasing."
            ],
            [
              "/info",
              "About Yokkai",
              "Explore the world behind your collection."
            ]
          ].map(([href, title, description]) => (
            <Link key={href} href={href}>
              <h3>
                {title} <span aria-hidden="true">↗</span>
              </h3>
              <p>{description}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function HomeSkeleton() {
  return (
    <div className="yk-home-skeleton" role="status">
      <span className="sr-only">Loading panel…</span>
      <div />
      <div />
      <div />
    </div>
  );
}
