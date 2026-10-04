import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { AccountMenu } from "@/components/account-menu";
import { SettingsPanel } from "@/components/settings";
import { getCurrentPseudo, getCurrentUser } from "@/lib/auth/session";

export default async function SettingsPage(){const user=await getCurrentUser();if(!user)redirect("/connexion");const name=await getCurrentPseudo(user.id);return <div className="w-full"><Topbar view="settings" account={<AccountMenu/>} name={name??undefined}/><main className="mx-auto w-full max-w-5xl px-6 py-10"><p className="eyebrow">Ton compte</p><h1 className="yk-title mt-3">Paramètres</h1><div className="mt-8"><SettingsPanel/></div></main></div>;}
