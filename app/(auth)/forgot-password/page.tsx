import type { Metadata } from "next";
import { PasswordResetRequestForm } from "@/components/password-reset-forms";

export const metadata: Metadata = {
  title: "Forgot password · Yokkai Collec’"
};

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ lien?: string }>;
}) {
  const { lien } = await searchParams;
  return (
    <section className="yk-auth-panel">
      <p className="eyebrow">Return to your collection</p>
      <h1 className="yk-auth-title">Reset your password</h1>
      <p className="yk-auth-intro">
        Enter your email address to receive a secure reset link.
      </p>
      <PasswordResetRequestForm
        invalidLink={lien === "erreur"}
        confirmationUnavailable={lien === "service"}
      />
    </section>
  );
}
