import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Connexion · Yokkai Collec’" };

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const { confirmation } = await searchParams;
  return <>
    <p className="eyebrow">La chasse continue</p>
    <h1 className="yk-auth-title">Content de te revoir</h1>
    <p className="yk-auth-intro">Retrouve ta collection. Elle t’attend dans l’ombre.</p>
    <AuthForm mode="signin" confirmationError={confirmation === "erreur"} />
  </>;
}
