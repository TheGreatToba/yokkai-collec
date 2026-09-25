import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Inscription · Yokkai Collec’" };

export default function SignUpPage() {
  return <>
    <p className="eyebrow">Entre dans la légende</p>
    <h1 className="mt-3 text-4xl font-bold tracking-tight">Commence ta collection</h1>
    <p className="mb-9 mt-4 text-sm leading-6 text-white/60">Un pseudo. Une première carte. Le reste appartient au destin.</p>
    <AuthForm mode="signup" />
  </>;
}
