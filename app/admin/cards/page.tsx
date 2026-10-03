import { AccountMenu } from "@/components/account-menu";
import { Topbar } from "@/components/topbar";
import { cookies } from "next/headers";
import { requireAdminPage } from "@/lib/auth/admin";
import { getCurrentPseudo } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import { AdminCardManager } from "./admin-card-manager";

export const dynamic = "force-dynamic";

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdminPage();
  const name = await getCurrentPseudo(admin.id);
  const client = createClient(await cookies());
  const { q } = await searchParams;
  const searchQuery = q?.trim().slice(0, 100) ?? "";
  let cardsQuery = client.from("cards")
    .select("id,nom,categorie,franchise,rarete_base,image_url")
    .limit(50);
  cardsQuery = searchQuery
    ? cardsQuery.ilike("nom", `%${searchQuery}%`).order("nom", { ascending: true })
    : cardsQuery.order("date_ajout", { ascending: false });
  const { data: cards, error } = await cardsQuery;
  if (error) throw new Error(error.message);
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Topbar view="admin" account={<AccountMenu/>} name={name ?? undefined}/>
      <main id="main-content" className="px-4 py-8 sm:px-8">
       <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Administration</p><h1 className="text-3xl font-black">Mise en ligne des cartes</h1><p className="text-sm text-slate-400">Connecté : {admin.email}</p></div>
        </header>
        <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-5">
          <h2 className="text-xl font-bold">Rechercher une carte du catalogue</h2>
          <p className="mt-1 text-sm text-slate-300">Écris tout ou partie du nom de la carte à modifier.</p>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" method="get">
            <input aria-label="Nom de la carte" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-white" defaultValue={searchQuery} maxLength={100} name="q" placeholder="Exemple : Luffy" required/>
            <button className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950" type="submit">Rechercher</button>
            {searchQuery && <a className="rounded-xl border border-white/15 px-5 py-3 text-center" href="/admin/cards">Effacer</a>}
          </form>
        </section>
        <AdminCardManager cards={cards ?? []} searchQuery={searchQuery}/>
       </div>
      </main>
    </div>
  );
}
