import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthExperience } from "@/components/auth-experience";

export const metadata: Metadata = {
  title: "Sign in · Yokkai Collec’",
  description:
    "Sign in to Yokkai Collec’ to explore your collection, open packs, and trade cards."
};

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ confirmation?: string; "mot-de-passe"?: string }>;
}) {
  const { confirmation, "mot-de-passe": passwordStatus } = await searchParams;
  return (
    <AuthExperience>
      <p className="eyebrow">The hunt continues</p>
      <h1 className="yk-auth-title">Welcome back</h1>
      <p className="yk-auth-intro">
        Your collection awaits. Step back into the adventure.
      </p>
      {passwordStatus === "modifie" && (
        <p role="status" className="yk-auth-notice">
          Your password has been updated. You can now sign in.
        </p>
      )}
      <AuthForm
        mode="signin"
        confirmationError={confirmation === "erreur"}
        confirmationUnavailable={confirmation === "service"}
      />
    </AuthExperience>
  );
}
