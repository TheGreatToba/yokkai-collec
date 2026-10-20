import type { Metadata } from "next";
import { Cinzel, Sora, Noto_Serif_JP } from "next/font/google";
import localFont from "next/font/local";
import { BoostersLoadPriority } from "@/components/boosters-load-priority";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { ProAccessProvider } from "@/components/pro-access";
import { ReferralReminder } from "@/components/referral-reminder";
import { DiscordPromo } from "@/components/discord-promo";
import { getDiscordInviteUrl } from "@/lib/discord-invite";
import "./globals.css";
import "../styles/ui.css";
import "../styles/community.css";
import "../styles/private-messages.css";
import "../styles/profile.css";
import "../styles/profile-style.css";
import "../styles/collection.css";
import "../styles/boosters.css";
import "../styles/pack-tear.css";
import "../styles/boosters-showcase.css";
import "../styles/market.css";
import "../styles/site-footer.css";
import "../styles/info-pages.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-cinzel",
  display: "swap"
});
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap"
});
const noto = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false
});
const inter = localFont({
  src: "./fonts/inter/InterVariable.ttf",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://yokkai-collec.com"
  ),
  openGraph: { locale: "en_US" },
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  title: "Yokkai Collec'",
  description:
    "Collect your favorite characters and discover five cards in every Regular Pack."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const discordEnabled = Boolean(getDiscordInviteUrl());

  return (
    <html
      lang="en"
      className={`h-full antialiased ${cinzel.variable} ${sora.variable} ${noto.variable} ${inter.variable}`}
    >
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link
            rel="preconnect"
            href={new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <BoostersLoadPriority>
          <PresenceHeartbeat />
          <ProAccessProvider>
            {children}
            <ReferralReminder />
            <DiscordPromo enabled={discordEnabled} />
          </ProAccessProvider>
        </BoostersLoadPriority>
      </body>
    </html>
  );
}
