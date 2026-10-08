import Link from "next/link";
import { cookies } from "next/headers";
import { AccountMenu } from "@/components/account-menu";
import { Topbar } from "@/components/topbar";
import { requireAdminPage } from "@/lib/auth/admin";
import { getCurrentKarasBalance, getCurrentPseudo } from "@/lib/auth/session";
import { createClient } from "@/utils/supabase/server";
import { AdminNavigation } from "../admin-navigation";
import { PlayerManager, type AdminPlayer, type AdminPlayerDetail } from "./player-manager";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

function playerFromRpc(value: Record<string, unknown>): AdminPlayer {
  return {
    userId: String(value.userId ?? ""), pseudo: String(value.pseudo ?? "Joueur"), email: String(value.email ?? ""),
    createdAt: String(value.createdAt ?? ""), lastSeenAt: typeof value.lastSeenAt === "string" ? value.lastSeenAt : null,
    cardsCount: Number(value.cardsCount ?? 0), karasBalance: Number(value.karasBalance ?? 0),
    isBanned: value.isBanned === true, isAdmin: value.isAdmin === true,
  };
}

export default async function AdminPlayersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; player?: string }> }) {
  const admin = await requireAdminPage();
  const client = createClient(await cookies());
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const playerId = /^[0-9a-f-]{36}$/i.test(params.player ?? "") ? params.player! : null;
  const [name, karas, listResult, detailResult] = await Promise.all([
    getCurrentPseudo(admin.id), getCurrentKarasBalance(client),
    client.rpc("admin_list_players", { p_query: query, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    playerId ? client.rpc("admin_get_player", { p_user_id: playerId }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (listResult.error) throw new Error(listResult.error.message);
  if (detailResult.error) throw new Error(detailResult.error.message);
  const payload = (listResult.data ?? {}) as Record<string, unknown>;
  const players = (Array.isArray(payload.players) ? payload.players : []).map(item => playerFromRpc(item as Record<string, unknown>));
  const total = Number(payload.total ?? 0);
  const rawDetail = detailResult.data as Record<string, unknown> | null;
  const selected = rawDetail ? {
    ...playerFromRpc(rawDetail),
    cards: Array.isArray(rawDetail.cards) ? rawDetail.cards.map(card => {
      const item = card as Record<string, unknown>;
      return { instanceId: String(item.instanceId), cardId:String(item.cardId), name: String(item.name), category: String(item.category), franchise: String(item.franchise ?? ""), rarity: String(item.rarity) as "C" | "R" | "SR" | "SSR" | "LR", imageUrl: String(item.imageUrl), catalogueImage:String(item.catalogueImage), customImageUrl:typeof item.customImageUrl==="string"?item.customImageUrl:null, obtainedAt: String(item.obtainedAt), shiny: item.shiny === true, evolved:item.evolved===true, firstOwner:item.firstOwner===true, locked:item.locked===true, activeAuctionId:typeof item.activeAuctionId==="string"?item.activeAuctionId:null };
    }) : [],
  } satisfies AdminPlayerDetail : null;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => `/admin/players?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) })}`;
  return <div className="min-h-screen bg-slate-950 text-white">
    <Topbar view="admin" account={<AccountMenu/>} name={name ?? undefined} karas={karas}/>
    <main id="main-content" className="px-4 py-8 sm:px-8"><div className="mx-auto max-w-7xl space-y-8">
      <header><p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Administration</p><h1 className="text-3xl font-black">Administration des joueurs</h1><p className="mt-1 text-sm text-slate-400">Recherche, inventaire et modération des comptes.</p></header>
      <AdminNavigation/>
      <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-5"><form className="flex flex-col gap-3 sm:flex-row" method="get"><input aria-label="Rechercher un joueur" className="yk-field-control flex-1" defaultValue={query} maxLength={100} name="q" placeholder="Pseudo ou adresse e-mail…"/><button className="yk-button" type="submit">Rechercher</button>{query && <Link className="yk-button yk-button-secondary" href="/admin/players">Effacer</Link>}</form><p className="mt-3 text-xs text-slate-500">{total} compte{total === 1 ? "" : "s"} trouvé{total === 1 ? "" : "s"}</p></section>
      <PlayerManager players={players} selected={selected}/>
      {pages > 1 && <nav aria-label="Pagination des joueurs" className="flex items-center justify-center gap-3"><Link aria-disabled={page === 1} className={`yk-button yk-button-secondary ${page === 1 ? "pointer-events-none opacity-50" : ""}`} href={href(page - 1)}>Précédent</Link><span className="text-sm text-slate-400">Page {page} sur {pages}</span><Link aria-disabled={page === pages} className={`yk-button yk-button-secondary ${page === pages ? "pointer-events-none opacity-50" : ""}`} href={href(page + 1)}>Suivant</Link></nav>}
    </div></main>
  </div>;
}
