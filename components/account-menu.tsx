import Link from "next/link";
import { getCurrentPseudo, getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) return <div className="flex items-center gap-4 text-sm">
    <Link href="/connexion">Connexion</Link>
    <Link href="/inscription" className="rounded-lg border border-lime-300/40 px-3 py-2 text-lime-300">S’inscrire</Link>
  </div>;
  const storedPseudo = await getCurrentPseudo(user.id);
  const metadataPseudo = typeof user.user_metadata?.pseudo === "string" ? user.user_metadata.pseudo.trim() : "";
  const pseudo = storedPseudo ?? (metadataPseudo || null);
  return <div className="flex flex-wrap items-center gap-3" aria-label="Mon compte">
    <span className="max-w-40 truncate text-sm text-lime-300" title={pseudo ?? undefined}>{pseudo ?? "Compte connecté"}</span>
    <SignOutButton />
    {!pseudo && <p role="status" className="w-full text-xs text-white/60">Votre pseudo est momentanément indisponible.</p>}
  </div>;
}
