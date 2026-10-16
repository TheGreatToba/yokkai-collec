import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account deleted · Yokkai Collec’",
  robots: { index: false, follow: false }
};

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="eyebrow">Confirmation</p>
      <h1 className="yk-title mt-3">Your account has been deleted</h1>
      <p className="mt-6 leading-7 text-ink-2">
        Your cards, Karas, avatar, and sign-in identity have been deleted. Your
        sessions have been revoked. Retained history will show “Deleted player”.
      </p>
      <Link href="/login" className="mt-8 inline-block underline">
        Back to sign in
      </Link>
    </main>
  );
}
