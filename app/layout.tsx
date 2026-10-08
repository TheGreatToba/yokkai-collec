import type { Metadata } from "next";
import { Cinzel, Sora, Noto_Serif_JP } from "next/font/google";
import localFont from "next/font/local";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import "./globals.css";
import "../styles/ui.css";
import "../styles/community.css";
import "../styles/collection.css";
import "../styles/boosters.css";
import "../styles/market.css";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sora", display: "swap" });
const noto = Noto_Serif_JP({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-noto-jp", display: "swap", preload: false });
const hyWenHei = localFont({
  src: "./fonts/hywenhei-85w/HYWenHei-85W.ttf",
  weight: "700",
  style: "normal",
  variable: "--font-hy-wen-hei",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yokkai Collec'",
  description: "Collectionnez vos personnages et découvrez cinq cartes dans chaque Regular Pack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full antialiased ${cinzel.variable} ${sora.variable} ${noto.variable} ${hyWenHei.variable}`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col"><PresenceHeartbeat/>{children}</body>
    </html>
  );
}
