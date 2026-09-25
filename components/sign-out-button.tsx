"use client";

import { useActionState } from "react";
import { signOut } from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/forms";

export function SignOutButton() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signOut, {});
  return <form action={action}>
    <button type="submit" disabled={pending} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/70 disabled:opacity-50">
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
    {state.error && <p role="alert" className="mt-2 max-w-56 text-xs text-red-200">{state.error}</p>}
  </form>;
}
