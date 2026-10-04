"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { CollectedCard } from "@/lib/data/cards";
import { Avatar, Karas } from "@/components/ui";
import "@/styles/topbar.css";
import { markNotificationRead, type AppNotification } from "@/lib/data/notifications";
import { useSfx } from "@/hooks/use-sfx";
import { useNotificationFeed } from "@/hooks/use-notification-feed";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getProfile } from "@/lib/data/profile";
import { subscribePlayerSnapshotInvalidation } from "@/lib/data/player-state";

export type NotificationItem = { id: string; title: string; text: string; time: string; read: boolean; href?: string; kind: "wishlist" | "outbid" | "trade" | "pack" | "won" | "sold" | "friend" | "mission" };
const notificationStyle = {
  wishlist: ["♥", "text-rarity-ssr bg-rarity-ssr/14"], outbid: ["↑", "text-danger bg-danger/14"],
  trade: ["⇄", "text-accent-neon bg-accent-neon/14"], pack: ["✦", "text-accent-gold bg-accent-gold/14"],
  won: ["✓", "text-success bg-success/14"], sold: ["◆", "text-accent-gold bg-accent-gold/14"],
  friend: ["+", "text-accent-neon bg-accent-neon/14"], mission: ["✦", "text-success bg-success/14"],
};
export function notificationItem(notification:AppNotification):NotificationItem {
  const common={id:notification.id,time:new Date(notification.createdAt).toLocaleString("fr-FR"),read:!!notification.readAt};
  if(notification.type==="friend_request")return {...common,title:"Nouvelle demande d’ami",text:`${notification.actorPseudo??"Un collectionneur"} veut t’ajouter en ami.`,href:"/amis",kind:"friend"};
  if(notification.type==="outbid")return {...common,title:"Tu as été surenchéri",text:`Tu as été surenchéri sur ${notification.cardName??"une carte"}.`,href:`/marche/${notification.referenceId}`,kind:"outbid"};
  if(notification.type==="trade_offer_received")return {...common,title:"Nouvelle offre d’échange",text:`${notification.actorPseudo??"Un collectionneur"} t’a envoyé une offre d’échange.`,href:`/echanges?offre=${notification.referenceId}`,kind:"trade"};
  if(notification.type==="auction_won")return {...common,title:"Enchère remportée",text:`Tu as remporté ${notification.cardName??"une carte"} !`,href:`/marche/${notification.referenceId}`,kind:"won"};
  if(notification.type==="achievement_completed")return {...common,title:"Succès débloqué",text:`Nouveau succès : ${notification.achievementName??"un succès"}.`,href:`/succes#${notification.referenceId}`,kind:"mission"};
  return {...common,title:"Carte en wishlist aux enchères",text:`${notification.cardName??"Une carte"} de ta wishlist vient d’être mise aux enchères — clique pour voir.`,href:`/marche/${notification.referenceId}`,kind:"wishlist"};
}
export function Topbar({ view, account, name: providedName, karas, notifications, notificationError: externalNotificationError, onRetryNotifications, onRefreshNotifications, onReadAll, onOpenNotification }: {
  view: "packs" | "collection" | "profile" | "friends" | "market" | "auction" | "trades" | "search" | "wishlist" | "admin" | "achievements" | "settings"; account?: ReactNode; name?: string; collection?: CollectedCard[];
  karas?: number; notifications?: NotificationItem[]; notificationError?: string; onRetryNotifications?: () => void; onRefreshNotifications?: () => void; onReadAll?: () => void; onOpenNotification?: (id:string,href:string)=>Promise<void>;
}) {
  const sound = useSfx();
  const isAdmin = useIsAdmin();
  const [panel, setPanel] = useState<"notifications" | "account" | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [avatarUrl,setAvatarUrl]=useState<string>();
  const [profileName,setProfileName]=useState<string>();
  const feed=useNotificationFeed(!notifications);
  const loaded=feed.notifications?.map(notificationItem);
  const shown=notifications??loaded;
  const visibleNotificationError=externalNotificationError??feed.error;
  const unread = shown?.filter(n => !n.read).length;
  const name=providedName||profileName;
  useEffect(()=>{let active=true;const refreshProfile=()=>void getProfile().then(profile=>{if(active){setAvatarUrl(profile.avatarUrl??undefined);setProfileName(profile.pseudo);}},()=>undefined);refreshProfile();const unsubscribe=subscribePlayerSnapshotInvalidation(scopes=>{if(scopes.includes("profile"))refreshProfile();});return()=>{active=false;unsubscribe();};},[]);
  useEffect(()=>{if(!panel)return;const panelId=`${panel}-panel`;const closeOnOutsidePointer=(event:PointerEvent)=>{const target=event.target as Element|null;if(target?.closest(`#${panelId},[aria-controls="${panelId}"]`))return;setPanel(null);};document.addEventListener("pointerdown",closeOnOutsidePointer);return()=>document.removeEventListener("pointerdown",closeOnOutsidePointer);},[panel]);
  async function readAll(){if(onReadAll)await onReadAll();else{await markNotificationRead();feed.setNotifications(current=>current?.map(n=>({...n,readAt:n.readAt??new Date().toISOString()})));}}
  function toggleNotifications(){if(panel==="notifications"){setPanel(null);return;}setPanel("notifications");if(notifications)onRefreshNotifications?.();else void feed.refresh();}
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-accent-gold focus:p-3 focus:text-void">Aller au contenu</a>
    <header className="yk-topbar" data-mobile-menu={mobileMenu ? "open" : "closed"}>
      <Link href="/" className="yk-brand" aria-label="Yokkai Collec’, accueil"><span className="yk-logo">Y</span><span>Yokkai<br />Collec’</span></Link>
      <nav id="primary-navigation" aria-label="Navigation principale" className="yk-primary-nav">
        <Link href="/boosters" aria-current={view === "packs" ? "page" : undefined}>Boosters</Link>
        <Link href="/collection" aria-current={view === "collection" ? "page" : undefined}>Collection</Link>
        <Link href="/marche" aria-current={view === "market" || view === "auction" ? "page" : undefined}>Marché</Link>
        <Link href="/echanges" aria-current={view === "trades" ? "page" : undefined}>Échanges</Link>
        <Link href="/amis" aria-current={view === "friends" ? "page" : undefined}>Amis</Link>
        <Link href="/wishlist" aria-current={view === "wishlist" ? "page" : undefined}>Wishlist</Link>
        <Link href="/recherche" aria-current={view === "search" ? "page" : undefined}>Catalogue</Link>
        {isAdmin && <Link href="/admin/cards" aria-current={view === "admin" ? "page" : undefined}>Admin</Link>}
      </nav>
      <div className="yk-topbar-actions">
        <button type="button" className="yk-icon-button yk-menu-toggle" aria-label={mobileMenu ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={mobileMenu} aria-controls="primary-navigation" onClick={() => setMobileMenu(open => !open)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={mobileMenu ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}/></svg></button>
        <button type="button" onClick={sound.toggle} aria-pressed={sound.enabled} aria-label={sound.enabled ? "Désactiver les sons" : "Activer les sons"} title={sound.enabled ? "Son activé" : "Son coupé"} className="yk-icon-button"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 9h4l5-4v14l-5-4H4z"/>{sound.enabled ? <path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/> : <path d="m17 9 5 6m0-6-5 6"/>}</svg></button>
        <Link href="/recherche" className="yk-icon-button" aria-label="Ouvrir le catalogue"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg></Link>
        <div className="relative">
          <button type="button" className="yk-icon-button" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`} aria-expanded={panel === "notifications"} aria-controls="notifications-panel" onClick={toggleNotifications}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{!!unread && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-danger px-1 text-[10px] text-void">{unread}</span>}</button>
          {panel === "notifications" && <><button type="button" tabIndex={-1} aria-label="Fermer les notifications" className="yk-notification-backdrop" onClick={() => setPanel(null)} /><section id="notifications-panel" aria-label="Notifications" className="yk-notifications" onKeyDown={e => { if (e.key === "Escape") setPanel(null); }}><div className="yk-notification-head"><div><h2>Notifications</h2>{shown&&<p>{unread??0} non lue{unread===1?"":"s"}</p>}</div>{!!unread&&<button onClick={()=>void readAll()}>Tout marquer comme lu</button>}</div>
            {visibleNotificationError ? <div role="alert" className="yk-notification-state is-error"><span aria-hidden="true">!</span><strong>Impossible de charger tes notifications</strong><p>{visibleNotificationError}</p><button type="button" className="yk-button yk-button-secondary" onClick={()=>{if(onRetryNotifications)onRetryNotifications();else feed.retry();}}>Réessayer</button></div> : !shown ? <div className="yk-notification-state"><span className="yk-skeleton block h-10 w-10"/><p>Chargement des notifications…</p></div> : shown.length === 0 ? <div className="yk-notification-state"><span aria-hidden="true">♢</span><strong>Aucune notification pour le moment</strong><p>Tu es à jour. Tes alertes et activités apparaîtront ici.</p></div> : <ul className="yk-notification-list">{shown.map(n => {
              const [glyph, color] = notificationStyle[n.kind];
              const content = <><span className={`flex size-9 shrink-0 items-center justify-center rounded-input ${color}`}>{glyph}</span><span className="min-w-0 flex-1 text-xs leading-5"><strong className="font-semibold text-ink">{n.title}</strong><span className="block text-ink-2">{n.text}</span><span className="text-ink-3">{n.time}</span></span>{!n.read && <span aria-label="Non lue" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-gold" />}</>;
              return <li key={n.id} className={n.read ? "is-read" : "is-unread"} data-notification-kind={n.kind}>{n.href ? <Link href={n.href} onClick={e=>{e.preventDefault();void (onOpenNotification?onOpenNotification(n.id,n.href!):markNotificationRead(n.id).then(()=>window.location.assign(n.href!)));}}>{content}</Link> : <div>{content}</div>}</li>;
            })}</ul>}
          </section></>}
        </div>
        <span className="yk-balance" title={karas == null ? "Chargement du solde" : "Mon solde"}>{karas == null ? <span role="status" aria-label="Chargement du solde Karas" className="yk-balance-skeleton" /> : <Karas amount={karas} />}</span>
        <div className="relative"><button type="button" aria-label="Ouvrir mon compte" title="Mon compte" aria-expanded={panel==="account"} aria-controls="account-panel" className="yk-account-trigger" onClick={()=>setPanel(current=>current==="account"?null:"account")}><Avatar name={name || "Compte"} image={avatarUrl} /><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 10 5 5 5-5"/></svg></button>{panel==="account"&&<><button type="button" tabIndex={-1} aria-label="Fermer le compte" className="yk-notification-backdrop yk-account-backdrop" onClick={()=>setPanel(null)}/><section id="account-panel" aria-label="Menu du profil" className="yk-account-panel" onKeyDown={event=>{if(event.key==="Escape")setPanel(null);}}><p className="yk-account-overline">Profil utilisateur</p><div className="yk-account-summary"><Avatar name={name||"Compte"} image={avatarUrl} size={40}/><div><strong>{name||"Compte"}</strong><span>@{name||"compte"} · Chasseur</span>{karas!=null&&<small className="yk-account-karas">{karas.toLocaleString("fr-FR")} Karas</small>}</div></div><nav aria-label="Actions du profil" className="yk-account-actions"><Link href="/profil" className="yk-account-action" onClick={()=>setPanel(null)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Voir mon profil</Link><Link href="/profil?edition=1" className="yk-account-action" onClick={()=>setPanel(null)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.35.72.6 1 .3.3.68.44 1.1.44h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg>Paramètres</Link><Link href="/succes" className="yk-account-action" onClick={()=>setPanel(null)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM10 17h4M12 13v4M8 21h8M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4"/></svg>Mes succès</Link></nav><div className="yk-account-separator"/>{account||<p className="yk-account-unavailable">Session indisponible.</p>}</section></>}</div>
      </div>
    </header>
  </>;
}
