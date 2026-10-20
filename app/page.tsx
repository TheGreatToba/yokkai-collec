import type { Metadata } from "next";
import AuthLayout from "./(auth)/layout";
import SignUpPage from "./(auth)/signup/page";
import { getCurrentUser } from "@/lib/auth/session";
import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = {
  title: "Yokkai Collec' · Start your collection",
  description:
    "Create your free account, collect your favorite characters, customize your cards, complete binders, and trade with friends.",
  alternates: { canonical: "/" },
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

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (user) return <HomeDashboard userId={user.id} />;
  return (
    <AuthLayout>
      <SignUpPage searchParams={searchParams} />
    </AuthLayout>
  );
}
