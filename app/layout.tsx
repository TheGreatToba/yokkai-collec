import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yokkai Collec'",
  description: "Jeu de collection de cartes — prototype v0.1.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
