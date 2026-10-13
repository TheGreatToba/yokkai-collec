import type { Metadata } from "next";
import { Cinzel, Sora, Noto_Serif_JP } from "next/font/google";
import localFont from "next/font/local";
import { BoostersLoadPriority } from "@/components/boosters-load-priority";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import "./globals.css";
import "../styles/ui.css";
import "../styles/community.css";
import "../styles/collection.css";
import "../styles/boosters.css";
import "../styles/market.css";

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
const hyWenHei = localFont({
  src: "./fonts/hywenhei-85w/HYWenHei-85W.ttf",
  weight: "700",
  style: "normal",
  variable: "--font-hy-wen-hei",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://yokkai-collec.com"
  ),
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  title: "Yokkai Collec'",
  description:
    "Collectionnez vos personnages et découvrez cinq cartes dans chaque Regular Pack."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`h-full antialiased ${cinzel.variable} ${sora.variable} ${noto.variable} ${hyWenHei.variable}`}
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
          {children}
        </BoostersLoadPriority>
      </body>
    </html>
  );
}
