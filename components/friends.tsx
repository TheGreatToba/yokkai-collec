"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Avatar, Button, Modal, StatusPill, Tabs } from "@/components/ui";
import { getFriendships, respondFriendRequest, searchUsers, sendFriendRequest, type Friendships, type FriendUser, type FriendshipStatus } from "@/lib/data/friends";

export type FriendActionAdapter = {
  send: (userId: string) => Promise<unknown>;
  friendships: () => Promise<Friendships>;
  respond: (requestId: string, accept: boolean) => Promise<unknown>;
};
const liveFriendActions: FriendActionAdapter = { send: sendFriendRequest, friendships: getFriendships, respond: respondFriendRequest };

const statusLabel: Record<FriendshipStatus, string> = { none: "Ajouter en ami", incoming: "Demande reçue", outgoing: "Demande envoyée", accepted: "Déjà ami", self: "Votre profil" };

export function FriendAction({ userId, status, onChanged, adapter = liveFriendActions }: { userId: string; status: FriendshipStatus; onChanged?: () => void; adapter?: FriendActionAdapter }) {
  const [state, setState] = useState(status); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [confirmRefusal, setConfirmRefusal] = useState(false);
  async function send() { setBusy(true); setError(""); try { await adapter.send(userId); setState("outgoing"); onChanged?.(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(false); } }
  async function respond(accept: boolean) { setBusy(true); setError(""); try { const friendships = await adapter.friendships(); const request = friendships.incoming.find(person => person.id === userId); if (!request?.requestId) throw new Error("Cette demande n’est plus disponible."); await adapter.respond(request.requestId, accept); setState(accept ? "accepted" : "none"); setConfirmRefusal(false); onChanged?.(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(false); } }
  return <div className="yk-friend-action">
    {state === "none" && <Button variant="secondary" disabled={busy} onClick={() => void send()}><span aria-hidden="true">＋</span> Ajouter en ami</Button>}
    {state === "incoming" && <div className="yk-friend-action-buttons"><Button disabled={busy} onClick={() => void respond(true)}>Accepter</Button><Button variant="secondary" disabled={busy} onClick={() => setConfirmRefusal(true)}>Refuser</Button></div>}
    {(state === "outgoing" || state === "accepted" || state === "self") && <StatusPill tone={state === "accepted" ? "success" : "gold"}>{statusLabel[state]}</StatusPill>}
    {error && <p role="alert" className="yk-inline-error">{error}</p>}
    <Modal open={confirmRefusal} onClose={() => setConfirmRefusal(false)} title="Refuser cette demande ?" className="max-w-md"><p className="text-sm leading-6 text-ink-2">La demande disparaîtra de votre liste. Cette personne pourra vous en envoyer une nouvelle plus tard.</p><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setConfirmRefusal(false)}>Annuler</Button><Button variant="danger" disabled={busy} onClick={() => void respond(false)}>{busy ? "Refus…" : "Refuser"}</Button></div></Modal>
  </div>;
}

function Person({ person, actions }: { person: FriendUser; actions?: ReactNode }) { return <li className="yk-social-person"><Avatar name={person.pseudo} image={person.avatarUrl??undefined} /><Link href={`/profil/${encodeURIComponent(person.pseudo)}`}><strong>{person.pseudo}</strong><small>Voir le profil</small></Link>{actions}</li>; }
type FriendsTab = "friends" | "incoming" | "outgoing";
const emptyCopy: Record<FriendsTab, { title: string; text: string }> = { friends: { title: "Votre cercle est encore vide", text: "Recherchez un pseudo pour inviter votre premier ami." }, incoming: { title: "Aucune demande reçue", text: "Les nouvelles invitations apparaîtront ici." }, outgoing: { title: "Aucune demande envoyée", text: "Vos invitations en attente apparaîtront ici." } };

export type FriendsPanelAdapter = { friendships: () => Promise<Friendships>; search: (query: string) => Promise<FriendUser[]>; respond: (requestId: string, accept: boolean) => Promise<unknown>; action?: FriendActionAdapter };
const liveFriendsPanel: FriendsPanelAdapter = { friendships: getFriendships, search: searchUsers, respond: respondFriendRequest };

export function FriendsPanel({ adapter = liveFriendsPanel }: { adapter?: FriendsPanelAdapter } = {}) {
  const [data, setData] = useState<Friendships>(); const [tab, setTab] = useState<FriendsTab>("friends"); const [query, setQuery] = useState(""); const [results, setResults] = useState<FriendUser[]>([]); const [error, setError] = useState(""); const [searching, setSearching] = useState(false); const [refusal, setRefusal] = useState<FriendUser>();
  async function load() { try { setData(await adapter.friendships()); } catch (e) { setError(e instanceof Error ? e.message : "Chargement impossible."); } }
  useEffect(() => { let active = true; void adapter.friendships().then(value => { if (active) setData(value); }, e => { if (active) setError(e instanceof Error ? e.message : "Chargement impossible."); }); return () => { active = false; }; }, [adapter]);
  useEffect(() => { if (query.trim().length < 2) return; let active = true; const timer = window.setTimeout(() => { setResults([]); setSearching(true); void adapter.search(query).then(value => { if (active) setResults(value); }, e => { if (active) setError(e instanceof Error ? e.message : "Recherche impossible."); }).finally(() => { if (active) setSearching(false); }); }, 250); return () => { active = false; window.clearTimeout(timer); }; }, [query, adapter]);
  async function respond(id: string, accept: boolean) { setError(""); try { await adapter.respond(id, accept); setRefusal(undefined); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } }
  const lists = { friends: data?.friends ?? [], incoming: data?.incoming ?? [], outgoing: data?.outgoing ?? [] }; const current = lists[tab];
  return <div className="yk-social-stack">
    <section className="yk-social-search"><div><p className="eyebrow">Trouver un joueur</p><h2 className="yk-section-title mt-2">Agrandir votre cercle</h2></div><label className="yk-social-search-field"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un joueur par pseudo" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un pseudo…" /></label>{query.trim().length > 0 && query.trim().length < 2 && <p className="yk-search-hint">Saisissez au moins deux caractères.</p>}{searching && <p className="yk-search-hint" role="status">Recherche…</p>}{query.trim().length >= 2 && !searching && !results.length && <div className="yk-social-empty is-compact"><strong>Aucun joueur trouvé</strong><span>Essayez un autre pseudo.</span></div>}{!!results.length && <ul className="yk-social-list is-search">{results.map(person => <Person key={person.id} person={person} actions={<FriendAction key={`${person.id}:${person.status}`} userId={person.id} status={person.status ?? "none"} onChanged={() => void load()} adapter={adapter.action} />} />)}</ul>}</section>
    <section className="yk-social-panel"><Tabs label="Relations" value={tab} onChange={value => setTab(value as FriendsTab)} items={[{ id: "friends", label: `Mes amis · ${lists.friends.length}` }, { id: "incoming", label: `Demandes reçues · ${lists.incoming.length}` }, { id: "outgoing", label: `Demandes envoyées · ${lists.outgoing.length}` }]} />{current.length ? <ul className="yk-social-list">{current.map(person => <Person key={person.requestId ?? person.id} person={person} actions={tab === "incoming" ? <div className="yk-friend-action-buttons"><Button onClick={() => void respond(person.requestId!, true)}>Accepter</Button><Button variant="secondary" onClick={() => setRefusal(person)}>Refuser</Button></div> : <StatusPill tone={tab === "friends" ? "success" : "gold"}>{tab === "friends" ? "Ami" : "En attente"}</StatusPill>} />)}</ul> : <div className="yk-social-empty"><span className="yk-social-empty-icon" aria-hidden="true">◇</span><strong>{emptyCopy[tab].title}</strong><p>{emptyCopy[tab].text}</p></div>}</section>
    {error && <p role="alert" className="yk-social-alert">{error}</p>}
    <Modal open={!!refusal} onClose={() => setRefusal(undefined)} title="Refuser cette demande ?" className="max-w-md"><p className="text-sm leading-6 text-ink-2">La demande de <strong className="text-ink">{refusal?.pseudo}</strong> sera supprimée.</p><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setRefusal(undefined)}>Annuler</Button><Button variant="danger" onClick={() => refusal?.requestId && void respond(refusal.requestId, false)}>Refuser</Button></div></Modal>
  </div>;
}
