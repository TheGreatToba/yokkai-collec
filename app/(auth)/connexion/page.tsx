import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Connexion · Yokkai Collec’" };

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ confirmation?: string; "mot-de-passe"?: string }>;
}) {
  const { confirmation, "mot-de-passe": passwordStatus } = await searchParams;
  return (
    <>
      <p className="eyebrow">La chasse continue</p>
      <h1 className="yk-auth-title">Content de te revoir</h1>
      <p className="yk-auth-intro">
        Retrouve ta collection. Elle t’attend dans l’ombre.
      </p>
      {passwordStatus === "modifie" && (
        <p role="status" className="yk-auth-notice">
          Ton mot de passe a été modifié. Tu peux maintenant te connecter.
        </p>
      )}
      <AuthForm mode="signin" confirmationError={confirmation === "erreur"} />
    </>
  );
}
