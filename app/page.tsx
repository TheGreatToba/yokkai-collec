import Link from "next/link";
import Image from "next/image";
import { YokaiCard } from "@/components/yokai-card";
import { getCurrentUser } from "@/lib/auth/session";
import "@/styles/landing.css";

const featuredCards = [
  {
    name: "Levi",
    rarity: "SSR" as const,
    category: "Anime/Manga",
    anime: "Attack on Titan",
    image:
      "https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png"
  },
  {
    name: "Satoru Gojou",
    rarity: "LR" as const,
    shiny: true,
    category: "Anime/Manga",
    anime: "Jujutsu Kaisen",
    image:
      "https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png"
  },
  {
    name: "Luffy Monkey",
    rarity: "LR" as const,
    category: "Anime/Manga",
    anime: "One Piece",
    image:
      "https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png"
  }
];

const steps = [
  ["01", "Ouvrez", "Recevez régulièrement un pack de cinq cartes."],
  [
    "02",
    "Collectionnez",
    "Découvrez des personnages venus de tous les univers."
  ],
  ["03", "Échangez", "Complétez votre collection avec les autres joueurs."]
];

export default async function Home() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/boosters" : "/inscription";
  return (
    <div className="yk-landing">
      <header className="yk-landing-header">
        <Link
          href="/"
          className="yk-landing-brand"
          aria-label="Yokkai Collec’, accueil"
        >
          <Image
            className="yk-landing-brand-image"
            src="/assets/header-logo-gold.png"
            alt=""
            width={1774}
            height={887}
            priority
          />
        </Link>
        <nav aria-label="Navigation d’accueil" className="yk-landing-nav">
          <a href="#concept">Le concept</a>
          {user ? (
            <Link href="/boosters" className="yk-landing-login">
              Entrer dans le jeu
            </Link>
          ) : (
            <Link href="/connexion" className="yk-landing-login">
              Connexion
            </Link>
          )}
        </nav>
      </header>
      <main id="main-content">
        <section className="yk-landing-hero">
          <div className="yk-landing-copy">
            <p className="eyebrow">Votre collection commence ici</p>
            <h1>
              Invoquez.
              <br />
              Collectionnez.
              <br />
              <em>Complétez.</em>
            </h1>
            <p className="yk-landing-lead">
              Ouvrez des packs, révélez des personnages iconiques et bâtissez
              une collection qui ne ressemble qu’à vous.
            </p>
            <div className="yk-landing-actions">
              <Link
                href={primaryHref}
                className="yk-button yk-button-primary yk-landing-cta"
              >
                {user ? "Ouvrir mon pack" : "Commencer l’aventure"}
                <span aria-hidden="true">✦</span>
              </Link>
              {!user && (
                <Link
                  href="/connexion"
                  className="yk-button yk-button-secondary"
                >
                  J’ai déjà un compte
                </Link>
              )}
            </div>
            <div
              className="yk-landing-proof"
              aria-label="Fonctionnalités principales"
            >
              <span>
                <b>5</b> cartes par pack
              </span>
              <span>
                <b>5</b> raretés
              </span>
              <span>
                <b>∞</b> collections possibles
              </span>
            </div>
          </div>
          <div
            id="collection"
            className="yk-landing-cards"
            aria-label="Aperçu des cartes à collectionner"
          >
            <div className="yk-landing-aura" />
            {featuredCards.map((card, index) => (
              <div
                className={`yk-landing-card yk-landing-card-${index + 1}`}
                key={card.name}
              >
                <YokaiCard {...card} />
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
              <p className="eyebrow">Le rituel</p>
              <h2 id="concept-title">Une collection vivante.</h2>
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
          <p className="eyebrow">Prêt à tenter votre chance ?</p>
          <h2>Votre prochain personnage préféré vous attend.</h2>
          <Link
            href={primaryHref}
            className="yk-button yk-button-primary yk-landing-cta"
          >
            {user ? "Voir mes boosters" : "Créer ma collection"}
          </Link>
        </section>
      </main>
      <footer className="yk-landing-footer">
        <span>Yokkai Collec’</span>
        <span>À chaque carte, une découverte.</span>
      </footer>
    </div>
  );
}
