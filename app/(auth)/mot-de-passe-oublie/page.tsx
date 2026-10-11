import type { Metadata } from "next";
import { PasswordResetRequestForm } from "@/components/password-reset-forms";

export const metadata: Metadata = {
  title: "Mot de passe oublié · Yokkai Collec’"
};

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ lien?: string }>;
}) {
  const { lien } = await searchParams;
  return (
    <>
      <p className="eyebrow">Retrouve ta collection</p>
      <h1 className="yk-auth-title">Réinitialise ton mot de passe</h1>
      <p className="yk-auth-intro">
        Indique ton adresse email pour recevoir un lien sécurisé.
      </p>
      <PasswordResetRequestForm invalidLink={lien === "erreur"} />
    </>
  );
}
