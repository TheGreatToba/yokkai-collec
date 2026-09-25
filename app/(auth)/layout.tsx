import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/boosters");
  return <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 sm:px-10">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-7">
      <Link href="/" className="text-xl font-black tracking-tight">YOKKAI<span className="text-lime-300"> COLLEC’</span></Link>
      <Link href="/" className="text-sm text-white/60">← Retour à l’accueil</Link>
    </header>
    <main className="mx-auto w-full max-w-md flex-1 py-14 sm:py-20">{children}</main>
    <footer className="border-t border-white/10 py-6 text-xs text-white/40">Yokkai Collec’ · À chaque carte, une découverte.</footer>
  </div>;
}
