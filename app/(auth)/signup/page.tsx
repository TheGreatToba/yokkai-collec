import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthExperience } from "@/components/auth-experience";
import { normalizeReferralCode } from "@/lib/auth/forms";

export const metadata: Metadata = {
  title: "Sign up · Yokkai Collec’",
  description:
    "Create your Yokkai Collec’ account and start collecting your favorite characters with your first packs."
};

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const referralCode = normalizeReferralCode(
    Array.isArray(params.ref) ? params.ref[0] : params.ref
  );
  return (
    <AuthExperience>
      <p className="eyebrow">Your adventure awaits</p>
      <h1 className="yk-auth-title">Start your collection</h1>
      <p className="yk-auth-intro">
        One username. One first card. Let fate take care of the rest.
      </p>
      <AuthForm mode="signup" referralCode={referralCode ?? undefined} />
    </AuthExperience>
  );
}
