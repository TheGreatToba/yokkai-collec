import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { AccountMenu } from "@/components/account-menu";
import { SettingsPanel } from "@/components/settings";
import { DataExportForm } from "@/components/data-export-form";
import { AccountDeletionForm } from "@/components/account-deletion-form";
import { SubscriptionSettings } from "@/components/subscription-settings";
import { ReferralPanel } from "@/components/referral-panel";
import { SiteFooter } from "@/components/site-footer";
import { getBillingSettings } from "@/lib/billing/settings";
import { getDiscordInviteUrl } from "@/lib/discord-invite";
import { getReferralStatus } from "@/lib/referrals/server";
import {
  getCurrentKarasBalance,
  getCurrentPseudo,
  getCurrentUser
} from "@/lib/auth/session";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [name, karas, billing, referral] = await Promise.all([
    getCurrentPseudo(user.id),
    getCurrentKarasBalance(),
    getBillingSettings(user.id),
    getReferralStatus()
  ]);
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const siteOrigin = (() => {
    try {
      return new URL(configuredOrigin || "http://localhost:3000").origin;
    } catch {
      return "http://localhost:3000";
    }
  })();
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <Topbar
        view="settings"
        account={<AccountMenu />}
        name={name ?? undefined}
        karas={karas}
      />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p className="eyebrow">Your account</p>
        <h1 className="yk-title mt-3">Settings</h1>
        <div className="mt-8">
          <SubscriptionSettings billing={billing} />
          <ReferralPanel initialStatus={referral} siteOrigin={siteOrigin} />
          <SettingsPanel />
          <DataExportForm />
          {name && (
            <div className="mt-6">
              <AccountDeletionForm pseudo={name} />
            </div>
          )}
        </div>
      </main>
      <SiteFooter discordEnabled={Boolean(getDiscordInviteUrl())} />
    </div>
  );
}
