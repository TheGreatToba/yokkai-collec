import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Sign up · Yokkai Collec’",
  description:
    "Create your Yokkai Collec’ account and start collecting your favorite characters with your first packs."
};

export default function SignUpPage() {
  return (
    <>
      <p className="eyebrow">Your adventure awaits</p>
      <h1 className="yk-auth-title">Start your collection</h1>
      <p className="yk-auth-intro">
        One username. One first card. Let fate take care of the rest.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
