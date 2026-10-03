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
  return <div className="yk-account-session" aria-label="Session du compte">
    <span className="yk-account-session-label">Connecté en tant que</span>
    <strong title={pseudo ?? undefined}>{pseudo ?? "Compte connecté"}</strong>
    <SignOutButton />
    {!pseudo && <p role="status">Votre pseudo est momentanément indisponible.</p>}
  </div>;
}
