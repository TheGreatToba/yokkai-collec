"use client";

import { useActionState, useState } from "react";
import { Button, Modal } from "@/components/ui";
import {
  createCardAction,
  deleteCardAction,
  importCardsAction,
  updateCardAction,
  type AdminActionState
} from "./actions";

type Card = {
  id: string;
  nom: string;
  categorie: string;
  franchise: string;
  rarete_base: string;
  image_url: string;
};

const initialState: AdminActionState = { ok: false, message: "" };

function Feedback({ state }: { state: AdminActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${state.ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-red-400/40 bg-red-500/10 text-red-100"}`}
    >
      <p>{state.message}</p>
      {state.details?.length ? (
        <ul className="mt-2 list-disc pl-5">
          {state.details.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"
      type="submit"
    >
      {children}
    </button>
  );
}

function CardRow({ card }: { card: Card }) {
  const [updateState, updateAction, updating] = useActionState(
    updateCardAction,
    initialState
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteCardAction,
    initialState
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <form
        action={updateAction}
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 xl:items-end"
      >
        <input name="id" type="hidden" value={card.id} />
        <label className="grid gap-1 text-xs text-slate-300">
          Nom
          <input
            className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
            defaultValue={card.nom}
            name="nom"
            required
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300">
          Saga
          <input
            className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
            defaultValue={card.categorie}
            name="categorie"
            required
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300">
          Licence (facultatif)
          <input
            className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
            defaultValue={card.franchise}
            name="franchise"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300">
          Rareté
          <select
            className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
            defaultValue={card.rarete_base}
            name="rarete_base"
          >
            {["C", "R", "SR", "SSR", "LR"].map(rarity => (
              <option key={rarity}>{rarity}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-300 xl:col-span-2">
          Nouvelle URL d’image (facultatif)
          <input
            className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
            name="image_url"
            placeholder="Conserver l’image actuelle"
            type="url"
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-300 xl:col-span-2">
          ou nouveau fichier (facultatif)
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
            name="image_file"
            type="file"
          />
        </label>
        <button
          className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm text-cyan-100 disabled:opacity-50"
          disabled={updating}
        >
          {updating ? "…" : "Modifier"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <a
          className="max-w-xl truncate text-xs text-cyan-300 underline"
          href={card.image_url}
          rel="noreferrer"
          target="_blank"
        >
          {card.image_url}
        </a>
        <button
          className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-200 disabled:opacity-50"
          disabled={deleting}
          type="button"
          onClick={() => setDeleteConfirm(true)}
        >
          Supprimer
        </button>
      </div>
      <Feedback state={updateState} />
      <Modal
        open={deleteConfirm}
        onClose={() => {
          if (!deleting) setDeleteConfirm(false);
        }}
        title="Supprimer cette carte ?"
      >
        <p className="text-sm leading-6 text-ink-2">
          Tu es sur le point de supprimer définitivement{" "}
          <strong className="text-ink">{card.nom}</strong> du catalogue.
        </p>
        <p className="mt-3 text-sm text-danger-ink">
          Cette action est irréversible. Toutes les copies possédées seront
          retirées. Les enchères seront annulées avec remboursement de la mise
          en tête, et les échanges en attente concernés seront déclinés.
        </p>
        <Feedback state={deleteState} />
        <form action={deleteAction} className="mt-6 flex justify-end gap-3">
          <input name="id" type="hidden" value={card.id} />
          <Button
            variant="secondary"
            disabled={deleting}
            onClick={() => setDeleteConfirm(false)}
          >
            Annuler
          </Button>
          <Button variant="danger" disabled={deleting} type="submit">
            {deleting ? "Suppression…" : "Confirmer la suppression"}
          </Button>
        </form>
      </Modal>
    </article>
  );
}

export function AdminCardManager({
  cards,
  searchQuery = ""
}: {
  cards: Card[];
  searchQuery?: string;
}) {
  const [createState, createAction, creating] = useActionState(
    createCardAction,
    initialState
  );
  const [importState, importAction, importing] = useActionState(
    importCardsAction,
    initialState
  );
  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-2">
        <form
          action={createAction}
          className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5"
        >
          <h2 className="text-xl font-bold">Ajouter une carte</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Nom
              <input
                className="rounded-lg bg-slate-950 p-3"
                name="nom"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Catégorie
              <input
                className="rounded-lg bg-slate-950 p-3"
                name="categorie"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Licence (facultatif)
              <input className="rounded-lg bg-slate-950 p-3" name="franchise" />
            </label>
            <label className="grid gap-1 text-sm">
              Rareté
              <select
                className="rounded-lg bg-slate-950 p-3"
                defaultValue="C"
                name="rarete_base"
              >
                {["C", "R", "SR", "SSR", "LR"].map(rarity => (
                  <option key={rarity}>{rarity}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            URL HTTPS de l’image
            <input
              className="rounded-lg bg-slate-950 p-3"
              name="image_url"
              type="url"
            />
          </label>
          <label className="grid gap-1 text-sm">
            ou fichier image (6 Mio max.)
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="rounded-lg bg-slate-950 p-3"
              name="image_file"
              type="file"
            />
          </label>
          <SubmitButton>
            {creating ? "Mise en ligne…" : "Mettre en ligne"}
          </SubmitButton>
          <Feedback state={createState} />
        </form>

        <form
          action={importAction}
          className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5"
        >
          <h2 className="text-xl font-bold">Importer un CSV</h2>
          <p className="text-sm text-slate-300">
            Jusqu’à 500 lignes. Colonnes : nom, categorie, franchise,
            rarete_base et image_url. Une dernière colonne d’image sans titre
            est aussi reconnue. Le source_id manquant est créé automatiquement ;
            les lignes invalides sont ignorées sans bloquer les cartes valides.
            Les images sont téléchargées lentement (2 simultanées maximum).
          </p>
          <input
            accept=".csv,text/csv"
            className="w-full rounded-lg bg-slate-950 p-3"
            name="csv"
            required
            type="file"
          />
          <SubmitButton>
            {importing ? "Import en cours…" : "Importer les cartes"}
          </SubmitButton>
          <Feedback state={importState} />
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {searchQuery
              ? `Résultats pour « ${searchQuery} »`
              : "Cartes récentes"}
          </h2>
          <span className="text-sm text-slate-400">
            {cards.length} affichée(s)
          </span>
        </div>
        {searchQuery && cards.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-slate-300">
            Aucune carte trouvée avec ce nom ou cette licence.
          </p>
        ) : null}
        {cards.map(card => (
          <CardRow card={card} key={card.id} />
        ))}
      </section>
    </div>
  );
}
