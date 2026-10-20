import type { ReactNode } from "react";
import Link from "next/link";
import { AuthShowcase } from "@/components/auth-showcase";

export function AuthExperience({ children }: { children: ReactNode }) {
  return (
    <div className="yk-auth-experience">
      <section className="yk-auth-panel yk-auth-account">
        {children}
        <p className="yk-auth-account-note">
          Free to join. A whole collection to make your own.
        </p>
        <nav className="yk-auth-help" aria-label="About Yokkai">
          <Link href="/rarities">Rarities</Link>
          <span aria-hidden="true">·</span>
          <Link href="/rules">Community rules</Link>
          <span aria-hidden="true">·</span>
          <Link href="/info">About the game</Link>
        </nav>
      </section>
      <AuthShowcase />
    </div>
  );
}
