import Link from "next/link";

export const DISCORD_MARK_PATH = [
  "M19.6 5.34A18.1 18.1 0 0 0 15.14 4l-.56 1.14a16.5 16.5 0 0 0-5.15 0L8.86 4A18.4 18.4 0 0 0 4.4 5.35",
  "C1.58 9.53.82 13.6 1.2 17.6a18 18 0 0 0 5.47 2.76l1.34-1.84a11.8 11.8 0 0 1-2.1-1.01l.52-.4a13 13 0 0 0 11.14 0",
  "l.52.4c-.67.4-1.37.74-2.1 1.01l1.34 1.84a18 18 0 0 0 5.47-2.76c.45-4.64-.77-8.67-3.2-12.26ZM8.5 15.2",
  "c-1.06 0-1.94-.98-1.94-2.18 0-1.2.85-2.18 1.94-2.18 1.1 0 1.96.99 1.94 2.18 0 1.2-.86 2.18-1.94 2.18Zm7 0",
  "c-1.06 0-1.94-.98-1.94-2.18 0-1.2.85-2.18 1.94-2.18 1.1 0 1.96.99 1.94 2.18 0 1.2-.84 2.18-1.94 2.18Z"
].join("");

export function FooterNavigation() {
  return (
    <nav className="yk-site-footer-nav" aria-label="About Yokkai">
      <Link href="/rarities">Rarities</Link>
      <Link href="/rules">Rules</Link>
      <Link href="/terms">Terms of Use</Link>
      <Link href="/info">Info</Link>
    </nav>
  );
}

export function DiscordFooterLink() {
  return (
    <a
      href="/discord"
      target="_blank"
      rel="noopener noreferrer"
      className="yk-site-footer-discord"
      aria-label="Join the Yokkai Discord"
      title="Join the Yokkai Discord"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
      >
        <path d={DISCORD_MARK_PATH} />
      </svg>
    </a>
  );
}

export function SiteFooter({
  note = "A new discovery in every card.",
  discordEnabled = true,
  contactEmail
}: {
  note?: string;
  discordEnabled?: boolean;
  contactEmail?: string;
}) {
  return (
    <footer className="yk-site-footer">
      <div className="yk-site-footer-inner">
        <p className="yk-site-footer-brand">
          <Link href="/">Yokkai Collec&apos;</Link>
          <span>{note}</span>
        </p>
        <div className="yk-site-footer-actions">
          <FooterNavigation />
          {contactEmail && <a href={`mailto:${contactEmail}`}>Contact</a>}
          {discordEnabled && <DiscordFooterLink />}
        </div>
      </div>
    </footer>
  );
}
