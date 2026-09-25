"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Topbar } from "@/components/topbar";
import { Button, Karas, StatusPill, Toast } from "@/components/ui";
import { getGameInfo } from "@/lib/data/cards";
import { claimAchievement, getAchievements, type Achievement } from "@/lib/data/achievements";

function progressText(item: Achievement) {
  const value = `${item.progressCurrent.toLocaleString("fr-FR")}/${item.progressTarget.toLocaleString("fr-FR")}`;
  const suffix: Record<string, string> = {
    regular_packs_opened: "packs ouverts",
    decision_packs_completed: "Decision Packs finalisés",
    unique_cards_collected: "cartes différentes",
    first_lr_card: "carte LR",
    shiny_cards_collected: "carte Shiny",
    auctions_won: "enchère gagnée",
    trades_completed: "échange accepté",
    ssr_evolved_to_lr: "évolution réalisée",
  };
  if (item.conditionType === "cards_collected_category_percent") {
    return `${value} cartes${item.progressLabel ? ` · ${item.progressLabel}` : ""}`;
  }
  return `${value} ${suffix[item.conditionType] || ""}`.trim();
}

export function AchievementsPage({ account }: { account?: ReactNode }) {
  const [items, setItems] = useState<Achievement[]>([]);
  const [name, setName] = useState<string>();
  const [balance, setBalance] = useState<number>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([getAchievements(), getGameInfo()]).then(([achievements, game]) => {
      if (!active) return;
      setItems(achievements); setName(game.user.name); setBalance(game.karasBalance); setError("");
    }, reason => { if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger les succès."); });
    return () => { active = false; };
  }, []);

  async function claim(item: Achievement) {
    if (busy) return;
    setBusy(item.id); setError("");
    try {
      const result = await claimAchievement(item.id);
      setBalance(result.balance);
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, claimedAt: result.claimedAt } : entry));
      setToast(`Récompense réclamée : ${result.reward.toLocaleString("fr-FR")} Karas`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de réclamer la récompense."); }
    finally { setBusy(null); }
  }

  const completed = items.filter(item => item.completedAt).length;
  return <div className="w-full">
    <Topbar view="achievements" account={account} name={name} karas={balance} />
    <main id="main-content" className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="eyebrow">Votre parcours de collectionneur</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div><h1 className="yk-title">Succès</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink-2">Ouvrez, collectionnez et échangez. Chaque étape franchie débloque une récompense à réclamer.</p></div>
        <div className="rounded-panel border border-veil bg-surface px-5 py-4 text-right"><p className="text-xs text-ink-3">Progression globale</p><p className="mt-1 font-display text-2xl text-karas">{completed}/{items.length || 11}</p></div>
      </div>
      {error && <p role="alert" className="my-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger-ink">{error}</p>}
      {!items.length && !error ? <p role="status" className="mt-10 text-sm text-ink-2">Chargement des succès…</p> :
      <section aria-label="Liste des succès" className="mt-10 grid gap-4 md:grid-cols-2">
        {items.map(item => {
          const state = item.claimedAt ? "claimed" : item.completedAt ? "completed" : "locked";
          const percent = Math.min(100, item.progressTarget ? item.progressCurrent / item.progressTarget * 100 : 0);
          return <article key={item.id} className={`rounded-panel border p-5 transition-colors ${state === "claimed" ? "border-success/30 bg-success/5" : state === "completed" ? "border-accent-gold/55 bg-accent-gold/8" : "border-veil bg-surface"}`}>
            <div className="flex items-start gap-4"><span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-full border font-display text-lg ${state === "claimed" ? "border-success/40 bg-success/10 text-success" : state === "completed" ? "border-accent-gold/50 bg-accent-gold/10 text-karas" : "border-veil-strong bg-void text-ink-3"}`}>{state === "claimed" ? "✓" : state === "completed" ? "✦" : "◇"}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-semibold">{item.title}</h2><StatusPill tone={state === "claimed" ? "success" : state === "completed" ? "gold" : "info"}>{state === "claimed" ? "Réclamé" : state === "completed" ? "À réclamer" : "Verrouillé"}</StatusPill></div><p className="mt-2 text-sm leading-6 text-ink-2">{item.description}</p></div>
            </div>
            <div className="mt-5"><div className="mb-2 flex items-center justify-between gap-4 text-xs"><span className="text-ink-2">{progressText(item)}</span><Karas amount={item.karasReward} /></div><div className="h-1.5 overflow-hidden rounded-full bg-void"><div className={`h-full rounded-full ${state === "claimed" ? "bg-success" : "bg-accent-gold"}`} style={{ width: `${percent}%` }} /></div></div>
            {state === "completed" && <Button className="mt-5 w-full" disabled={busy !== null} onClick={() => void claim(item)}>{busy === item.id ? "Réclamation…" : "Réclamer la récompense"}</Button>}
          </article>;
        })}
      </section>}
    </main>
    <Toast message={toast} onDismiss={() => setToast("")} />
  </div>;
}
