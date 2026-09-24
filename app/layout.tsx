import type { Metadata } from "next";
import { Cinzel, Sora, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import "../styles/ui.css";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sora", display: "swap" });
const noto = Noto_Serif_JP({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-noto-jp", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Yokkai Collec'",
  description: "Jeu de collection de cartes — prototype v0.1.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full antialiased ${cinzel.variable} ${sora.variable} ${noto.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
