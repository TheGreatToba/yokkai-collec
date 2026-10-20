import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteFooter } from "@/components/site-footer";
import { getDiscordInviteUrl } from "@/lib/discord-invite";
import "@/styles/auth.css";

export default async function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  if (await getCurrentUser()) redirect("/boosters");
  return (
    <div className="yk-auth-shell">
      <header className="yk-auth-header">
        <Link
          href="/"
          className="yk-auth-brand"
          aria-label="Yokkai Collec’, home"
        >
          <Image
            className="yk-auth-brand-image"
            src="/assets/brand-logo-chrome.png"
            alt=""
            width={1672}
            height={941}
            priority
          />
        </Link>
        <Link href="/" className="yk-auth-return">
          <span aria-hidden="true">←</span> Back to home
        </Link>
      </header>
      <main id="main-content" className="yk-auth-main">
        {children}
      </main>
      <SiteFooter
        discordEnabled={Boolean(getDiscordInviteUrl())}
        contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()}
      />
    </div>
  );
}
