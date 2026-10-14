import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user)
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/connexion">Sign in</Link>
        <Link
          href="/inscription"
          className="rounded-lg border border-lime-300/40 px-3 py-2 text-lime-300"
        >
          Sign up
        </Link>
      </div>
    );
  return <SignOutButton />;
}
