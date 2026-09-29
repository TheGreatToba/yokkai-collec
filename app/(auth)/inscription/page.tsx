import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Inscription · Yokkai Collec’" };

export default function SignUpPage() {
  return <>
    <p className="eyebrow">Entre dans la légende</p>
    <h1 className="yk-auth-title">Commence ta collection</h1>
    <p className="yk-auth-intro">Un pseudo. Une première carte. Le reste appartient au destin.</p>
    <AuthForm mode="signup" />
  </>;
}
