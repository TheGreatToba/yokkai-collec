import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { AccountMenu } from "@/components/account-menu";
import { SettingsPanel } from "@/components/settings";
import { DataExportForm } from "@/components/data-export-form";
import { AccountDeletionForm } from "@/components/account-deletion-form";
import {
  getCurrentKarasBalance,
  getCurrentPseudo,
  getCurrentUser
} from "@/lib/auth/session";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [name, karas] = await Promise.all([
    getCurrentPseudo(user.id),
    getCurrentKarasBalance()
  ]);
  return (
    <div className="w-full">
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
          <SettingsPanel />
          <DataExportForm />
          {name && (
            <div className="mt-6">
              <AccountDeletionForm pseudo={name} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
