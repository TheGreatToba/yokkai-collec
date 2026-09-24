"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { CollectedCard } from "@/lib/data/cards";
import { Avatar, Karas, Modal } from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import "@/styles/topbar.css";

export type NotificationItem = { id: string; title: string; text: string; time: string; read: boolean; href?: string; kind: "wishlist" | "outbid" | "trade" | "pack" | "won" | "sold" | "friend" | "mission" };
const notificationStyle = {
  wishlist: ["♥", "text-rarity-ssr bg-rarity-ssr/14"], outbid: ["↑", "text-danger bg-danger/14"],
  trade: ["⇄", "text-accent-neon bg-accent-neon/14"], pack: ["✦", "text-accent-gold bg-accent-gold/14"],
  won: ["✓", "text-success bg-success/14"], sold: ["◆", "text-accent-gold bg-accent-gold/14"],
  friend: ["+", "text-accent-neon bg-accent-neon/14"], mission: ["✦", "text-success bg-success/14"],
};
export function Topbar({ view, account, name, collection = [], karas, notifications, onReadAll }: {
  view: "packs" | "collection" | "design"; account?: ReactNode; name?: string; collection?: CollectedCard[];
  karas?: number; notifications?: NotificationItem[]; onReadAll?: () => void;
}) {
  const [panel, setPanel] = useState<"search" | "notifications" | "account" | null>(null);
  const [query, setQuery] = useState("");
  const unread = notifications?.filter(n => !n.read).length;
  const results = collection.filter(c => `${c.name} ${c.category}`.toLocaleLowerCase("fr-FR").includes(query.toLocaleLowerCase("fr-FR")));
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-accent-gold focus:p-3 focus:text-void">Aller au contenu</a>
    <header className="yk-topbar">
      <Link href="/" className="yk-brand" aria-label="Yokkai Collec’, accueil"><span className="yk-logo">Y</span><span>Yokkai<br />Collec’</span></Link>
      <nav aria-label="Navigation principale" className="yk-tabs">
        <Link href="/" aria-current={view === "packs" ? "page" : undefined}>Boosters</Link>
        <Link href="/collection" aria-current={view === "collection" ? "page" : undefined}>Collection</Link>
        {["Marché", "Échanges", "Wishlist"].map(label => <button type="button" key={label} disabled title="Bientôt disponible">{label}</button>)}
      </nav>
      <div className="yk-topbar-actions">
        <Link href="/design-system" className="yk-design-link" aria-current={view === "design" ? "page" : undefined}>Design system</Link>
        <button type="button" className="yk-icon-button" aria-label="Rechercher dans ma collection" onClick={() => setPanel("search")}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg></button>
        <div className="relative">
          <button type="button" className="yk-icon-button" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`} aria-expanded={panel === "notifications"} aria-controls="notifications-panel" onClick={() => setPanel(panel === "notifications" ? null : "notifications")}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{!!unread && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-danger px-1 text-[10px] text-void">{unread}</span>}</button>
          {panel === "notifications" && <><button type="button" tabIndex={-1} aria-label="Fermer les notifications" className="fixed inset-0 cursor-default" onClick={() => setPanel(null)} /><section id="notifications-panel" aria-label="Notifications" className="yk-notifications" onKeyDown={e => { if (e.key === "Escape") setPanel(null); }}><div className="flex items-center justify-between gap-4 border-b border-veil p-5"><h2 className="font-display font-semibold">Notifications</h2>{onReadAll && <button className="text-xs text-accent-gold" onClick={onReadAll}>Tout marquer comme lu</button>}</div>
            {!notifications ? <p className="p-6 text-sm text-ink-2">Les notifications seront bientôt disponibles.</p> : notifications.length === 0 ? <p className="p-6 text-sm text-ink-2">Vous êtes à jour.</p> : <ul className="max-h-96 overflow-auto">{notifications.map(n => {
              const [glyph, color] = notificationStyle[n.kind];
              const content = <><span className={`flex size-9 shrink-0 items-center justify-center rounded-input ${color}`}>{glyph}</span><span className="min-w-0 flex-1 text-xs leading-5"><strong className="font-semibold text-ink">{n.title}</strong><span className="block text-ink-2">{n.text}</span><span className="text-ink-3">{n.time}</span></span>{!n.read && <span aria-label="Non lue" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-gold" />}</>;
              return <li key={n.id} className={n.read ? "" : "bg-veil/45"}>{n.href ? <Link href={n.href} className="flex gap-3 p-4 hover:bg-veil">{content}</Link> : <div className="flex gap-3 p-4">{content}</div>}</li>;
            })}</ul>}
          </section></>}
        </div>
        <span className="yk-balance" title={karas == null ? "Solde indisponible" : "Mon solde"}><Karas amount={karas} /></span>
        <button type="button" aria-label="Mon compte" aria-haspopup="dialog" className="rounded-full" onClick={() => setPanel("account")}><Avatar name={name || "Compte"} /></button>
      </div>
    </header>
    <Modal open={panel === "account"} onClose={() => setPanel(null)} title="Mon compte"><div className="flex items-center gap-4"><Avatar name={name || "Compte"} size={64} /><div>{account || <p className="text-ink-2">Connectez-vous pour retrouver votre compte.</p>}</div></div></Modal>
    <Modal open={panel === "search"} onClose={() => setPanel(null)} title="Rechercher dans ma collection"><label className="sr-only" htmlFor="collection-search">Nom ou catégorie</label><input id="collection-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom d’une carte, catégorie…" className="h-16 w-full rounded-full border border-veil-strong bg-void px-6 text-ink outline-offset-4" /><p role="status" className="my-5 text-sm text-ink-2">{results.length} résultat(s) dans votre collection</p><div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-5">{results.map(c => <Link key={c.instanceId} href="/collection" onClick={() => setPanel(null)} aria-label={`Voir ${c.name} dans ma collection`}><YokaiCard {...c} animated={false} /></Link>)}</div></Modal>
  </>;
}
