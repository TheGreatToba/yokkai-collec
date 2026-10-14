import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 py-12 text-center"
    >
      <p className="eyebrow">Error 404</p>
      <h1 className="yk-title">Page not found</h1>
      <p className="text-ink-2">
        The link may be outdated, or the page may have moved.
      </p>
      <Link href="/boosters" className="yk-button yk-button-primary">
        Back to the game
      </Link>
    </main>
  );
}
