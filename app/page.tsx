import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { YokaiCard } from "@/components/yokai-card";
import { getCurrentUser } from "@/lib/auth/session";
import "@/styles/landing.css";

export const metadata: Metadata = {
  openGraph: {
    title: "Yokkai Collec'",
    description:
      "Open packs, collect your favorite characters, and trade with other players.",
    type: "website",
    locale: "en_US",
    url: "/",
    images: [
      {
        url: "/og-home.png",
        width: 1200,
        height: 630,
        alt: "Yokkai Collec’ — Summon. Collect. Complete."
      }
    ]
  },
  twitter: { card: "summary_large_image", images: ["/og-home.png"] }
};

const featuredCards = [
  {
    name: "Levi",
    rarity: "SSR" as const,
    category: "Anime/Manga",
    anime: "Attack on Titan",
    image: "/assets/landing/levi.webp"
  },
  {
    name: "Satoru Gojou",
    rarity: "LR" as const,
    shiny: true,
    category: "Anime/Manga",
    anime: "Jujutsu Kaisen",
    image: "/assets/landing/gojou.webp"
  },
  {
    name: "Luffy Monkey",
    rarity: "LR" as const,
    category: "Anime/Manga",
    anime: "One Piece",
    image: "/assets/landing/luffy.webp"
  }
];

const steps = [
  ["01", "Open", "Get a fresh five-card pack regularly."],
  ["02", "Collect", "Discover characters from every universe."],
  ["03", "Trade", "Complete your collection by trading with other players."]
];

export default async function Home() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/boosters" : "/signup";
  return (
    <div className="yk-landing">
      <header className="yk-landing-header">
        <Link
          href="/"
          className="yk-landing-brand"
          aria-label="Yokkai Collec’, home"
        >
          <Image
            className="yk-landing-brand-image"
            src="/assets/brand-logo-chrome.png"
            alt=""
            width={1672}
            height={941}
            priority
          />
        </Link>
        <nav aria-label="Home navigation" className="yk-landing-nav">
          <a href="#concept">How it works</a>
          {user ? (
            <Link href="/boosters" className="yk-landing-login">
              Play now
            </Link>
          ) : (
            <Link href="/login" className="yk-landing-login">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main id="main-content">
        <section className="yk-landing-hero">
          <div className="yk-landing-copy">
            <p className="eyebrow">Your collection starts here</p>
            <h1>
              Summon.
              <br />
              Collect.
              <br />
              <em>Complete.</em>
            </h1>
            <p className="yk-landing-lead">
              Open packs, reveal iconic characters, and build a collection
              that&apos;s yours alone.
            </p>
            <div className="yk-landing-actions">
              <Link
                href={primaryHref}
                className="yk-button yk-button-primary yk-landing-cta"
              >
                {user ? "Open my pack" : "Start collecting"}
                <span aria-hidden="true">✦</span>
              </Link>
              {!user && (
                <Link href="/login" className="yk-button yk-button-secondary">
                  I already have an account
                </Link>
              )}
            </div>
            <div className="yk-landing-proof" aria-label="Key features">
              <span>
                <b>5</b> cards per pack
              </span>
              <span>
                <b>5</b> rarities
              </span>
              <span>
                <b>∞</b> possible collections
              </span>
            </div>
          </div>
          <div
            id="collection"
            className="yk-landing-cards"
            aria-label="Collectible card preview"
          >
            <div className="yk-landing-aura" />
            {featuredCards.map((card, index) => (
              <div
                className={`yk-landing-card yk-landing-card-${index + 1}`}
                key={card.name}
              >
                <YokaiCard {...card} imageSizes="100vw" />
              </div>
            ))}
            <span
              className="yk-landing-spark yk-landing-spark-1"
              aria-hidden="true"
            >
              ✦
            </span>
            <span
              className="yk-landing-spark yk-landing-spark-2"
              aria-hidden="true"
            >
              ✦
            </span>
          </div>
        </section>
        <section
          id="concept"
          className="yk-landing-concept"
          aria-labelledby="concept-title"
        >
          <div className="yk-landing-section-heading">
            <div>
              <p className="eyebrow">The ritual</p>
              <h2 id="concept-title">A collection that keeps growing.</h2>
            </div>
          </div>
          <div className="yk-landing-steps">
            {steps.map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="yk-landing-final">
          <p className="eyebrow">Ready to try your luck?</p>
          <h2>Your next favorite character is waiting.</h2>
          <Link
            href={primaryHref}
            className="yk-button yk-button-primary yk-landing-cta"
          >
            {user ? "View my packs" : "Start my collection"}
          </Link>
        </section>
      </main>
      <footer className="yk-landing-footer">
        <span>Yokkai Collec’</span>
        <span>A new discovery in every card.</span>
        {process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() && (
          <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL.trim()}`}>
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL.trim()}
          </a>
        )}
      </footer>
    </div>
  );
}
