import Link from "next/link";

export default function SharedCardNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-5 text-ink-1">
      <section className="max-w-lg text-center">
        <p className="eyebrow">Link not found</p>
        <h1 className="yk-title mt-4">This shared card no longer exists.</h1>
        <p className="mt-5 text-sm text-ink-2">
          The link is invalid or its owner has deleted it.
        </p>
        <Link
          className="yk-button yk-button-primary mt-8 inline-flex"
          href="/inscription"
        >
          Join Yokkai Collec&apos;
        </Link>
      </section>
    </main>
  );
}
