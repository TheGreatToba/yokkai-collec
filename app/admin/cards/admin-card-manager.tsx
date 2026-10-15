"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Modal } from "@/components/ui";
import {
  createCardAction,
  deleteCardAction,
  deleteCardsAction,
  previewDeleteCardsAction,
  importCardsAction,
  updateCardAction,
  type AdminActionState
} from "./actions";
import { MAX_BULK_DELETE_CARDS, type BulkDeletePreview } from "./bulk-delete";

type Card = {
  id: string;
  nom: string;
  categorie: string;
  franchise: string;
  franchises: string[];
  rarete_base: string;
  image_url: string;
};

const initialState: AdminActionState = { ok: false, message: "" };
const NEW_CATEGORY = "__new_category__";

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

function CategoryField({
  categories,
  initial = "",
  compact = false
}: {
  categories: string[];
  initial?: string;
  compact?: boolean;
}) {
  const initialChoice = initial
    ? categories.includes(initial)
      ? initial
      : NEW_CATEGORY
    : "";
  const [choice, setChoice] = useState(initialChoice);
  const [customCategory, setCustomCategory] = useState(
    initialChoice === NEW_CATEGORY ? initial : ""
  );
  const inputClass = compact
    ? "rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
    : "rounded-lg bg-slate-950 p-3";

  return (
    <div className="grid gap-2">
      <label
        className={`grid gap-1 ${compact ? "text-xs text-slate-300" : "text-sm"}`}
      >
        Catégorie
        <select
          className={inputClass}
          name={choice === NEW_CATEGORY ? undefined : "categorie"}
          onChange={event => setChoice(event.target.value)}
          ref={select => {
            if (!select) return;
            // React form actions invoke the native form reset after saving.
            // Keep its reset baseline aligned with the controlled selection.
            for (const option of select.options) {
              option.defaultSelected = option.value === choice;
            }
          }}
          required
          value={choice}
        >
          <option disabled value="">
            Choisir une catégorie
          </option>
          {categories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
          <option value={NEW_CATEGORY}>+ Nouvelle catégorie…</option>
        </select>
      </label>
      {choice === NEW_CATEGORY ? (
        <label
          className={`grid gap-1 ${compact ? "text-xs text-slate-300" : "text-sm"}`}
        >
          Nom de la nouvelle catégorie
          <input
            autoFocus
            className={inputClass}
            maxLength={100}
            name="categorie"
            onChange={event => setCustomCategory(event.target.value)}
            placeholder="Exemple : LITTÉRATURE"
            required
            value={customCategory}
          />
        </label>
      ) : null}
    </div>
  );
}

function LicenseFields({
  initial = [""],
  className = ""
}: {
  initial?: string[];
  className?: string;
}) {
  const [licenses, setLicenses] = useState(
    initial.length ? initial.slice(0, 10) : [""]
  );
  return (
    <fieldset className={`min-w-0 space-y-2 ${className}`}>
      <legend className="sr-only">Licences de la carte</legend>
      {licenses.map((license, index) => (
        <div
          className={
            index === 0
              ? "flex items-end gap-2"
              : "flex items-end gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] p-2"
          }
          key={index}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-xs text-slate-300">
            <span className="flex flex-wrap items-center gap-2">
              {index === 0
                ? "Licence principale"
                : `Licence secondaire ${index}`}
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-normal text-slate-400">
                {index === 0 ? "Visible sur la carte" : "Classeur uniquement"}
              </span>
            </span>
            <input
              className="min-w-0 rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
              value={license}
              maxLength={200}
              name="franchise"
              onChange={event =>
                setLicenses(current =>
                  current.map((item, currentIndex) =>
                    currentIndex === index ? event.target.value : item
                  )
                )
              }
            />
          </label>
          {index > 0 ? (
            <button
              aria-label={`Retirer la licence secondaire ${index}`}
              className="rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-200 transition hover:bg-red-400/10"
              onClick={() =>
                setLicenses(current =>
                  current.filter((_, currentIndex) => currentIndex !== index)
                )
              }
              type="button"
            >
              Retirer
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {licenses.length < 10 ? (
          <button
            className="rounded-lg border border-cyan-300/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
            onClick={() => setLicenses(current => [...current, ""])}
            type="button"
          >
            + Licence secondaire
          </button>
        ) : null}
        <p className="text-[11px] text-slate-500">
          Chaque licence ajoute la carte au Classeur correspondant.
        </p>
      </div>
    </fieldset>
  );
}

function CardRow({ card, categories }: { card: Card; categories: string[] }) {
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
      <form action={updateAction} className="space-y-4">
        <input name="id" type="hidden" value={card.id} />
        <div className="grid items-start gap-4 xl:grid-cols-12">
          <div className="grid gap-3 xl:col-span-5">
            <div className="grid gap-3 sm:grid-cols-5">
              <label className="grid gap-1 text-xs text-slate-300 sm:col-span-3">
                Nom
                <input
                  className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
                  defaultValue={card.nom}
                  name="nom"
                  required
                />
              </label>
              <div className="sm:col-span-2">
                <CategoryField
                  categories={categories}
                  compact
                  initial={card.categorie}
                />
              </div>
            </div>
            <label className="grid gap-1 text-xs text-slate-300">
              Nouvelle URL d’image (facultatif)
              <input
                className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
                name="image_url"
                placeholder="Conserver l’image actuelle"
                type="url"
              />
            </label>
            <label className="grid gap-1 text-xs text-slate-300">
              ou choisir un nouveau fichier (facultatif)
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
                name="image_file"
                type="file"
              />
            </label>
          </div>
          <LicenseFields
            className="xl:col-span-5"
            initial={
              card.franchises.length ? card.franchises : [card.franchise]
            }
          />
          <div className="grid gap-3 xl:col-span-2">
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
            <button
              className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-50"
              disabled={updating}
            >
              {updating ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
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

function BulkDeleteDialog({
  ids,
  preview,
  onClose,
  onDeleted
}: {
  ids: string[];
  preview: BulkDeletePreview;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [state, setState] = useState<AdminActionState>(initialState);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const deleted = state.ok;
  const impact: [string, number][] = [
    ["Cartes", preview.cards],
    ["Exemplaires détenus par des joueurs", preview.ownedCopies],
    ["Enchères actives (annulées, mise remboursée)", preview.activeAuctions],
    ["Échanges en attente (déclinés)", preview.pendingTrades],
    ["Liens de partage", preview.cardShares],
    ["Entrées de wishlist", preview.wishlists]
  ];
  return (
    <Modal
      open
      onClose={() => {
        if (!pending) (deleted ? onDeleted : onClose)();
      }}
      title={`Supprimer ${ids.length} carte(s) ?`}
    >
      {deleted ? null : (
        <>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm text-ink-2">
            {impact.map(([label, count]) => (
              <div className="contents" key={label}>
                <dt>{label}</dt>
                <dd className="text-right font-bold text-ink">{count}</dd>
              </div>
            ))}
          </dl>
          {preview.multiFranchiseCards.length ? (
            <details className="mt-3 text-sm text-ink-2">
              <summary className="cursor-pointer">
                {preview.multiFranchiseCards.length} carte(s) appartiennent
                aussi à une autre licence
              </summary>
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5">
                {preview.multiFranchiseCards.map(card => (
                  <li key={card.id}>
                    {card.name} — {card.franchises.join(" · ")}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="mt-3 text-sm text-danger-ink">
            Action irréversible, appliquée en une seule transaction : si une
            carte pose problème, rien n’est supprimé.
          </p>
          <label className="mt-4 grid gap-1 text-sm text-ink-2">
            Saisis {ids.length} pour confirmer
            <input
              autoComplete="off"
              className="rounded-lg border border-white/15 bg-slate-950 p-2 text-white"
              inputMode="numeric"
              onChange={event => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>
        </>
      )}
      <div aria-live="polite" className="mt-3">
        <Feedback state={state} />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        {deleted ? (
          <Button variant="secondary" onClick={onDeleted}>
            Fermer
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={pending || confirmation.trim() !== String(ids.length)}
              onClick={() =>
                startTransition(async () =>
                  setState(await deleteCardsAction(ids, confirmation))
                )
              }
            >
              {pending ? "Suppression…" : `Supprimer ${ids.length} carte(s)`}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

const ADMIN_CARDS_PER_PAGE = 20;

export function AdminCardManager({
  cards,
  categories,
  searchQuery = ""
}: {
  cards: Card[];
  categories: string[];
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
  const [cardsPage, setCardsPage] = useState(1);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkPreview, setBulkPreview] = useState<{
    ids: string[];
    preview: BulkDeletePreview;
  } | null>(null);
  const [bulkError, setBulkError] = useState<AdminActionState>(initialState);
  const [previewing, startPreview] = useTransition();
  // Only ids still present in the current results can ever be sent.
  const selectedIds = cards
    .filter(card => selected.has(card.id))
    .map(card => card.id);
  const pageCount = Math.max(1, Math.ceil(cards.length / ADMIN_CARDS_PER_PAGE));
  const safePage = Math.min(cardsPage, pageCount);
  const visibleCards = cards.slice(
    (safePage - 1) * ADMIN_CARDS_PER_PAGE,
    safePage * ADMIN_CARDS_PER_PAGE
  );

  const pageSelected = visibleCards.filter(card => selected.has(card.id));
  const allPageSelected =
    visibleCards.length > 0 && pageSelected.length === visibleCards.length;

  function setSelection(ids: string[], checked: boolean) {
    setBulkError(initialState);
    setSelected(current => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function openBulkDelete() {
    const ids = selectedIds;
    startPreview(async () => {
      const result = await previewDeleteCardsAction(ids);
      setBulkError(result);
      if (result.preview) setBulkPreview({ ids, preview: result.preview });
    });
  }

  function goToPage(page: number) {
    setEditingCardId(null);
    setCardsPage(page);
  }
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
            <CategoryField categories={categories} />
            <LicenseFields />
            <label className="grid self-start gap-1 text-sm">
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
        {visibleCards.length ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex min-h-11 items-center gap-2 text-slate-300">
              <input
                checked={allPageSelected}
                className="size-5"
                onChange={event =>
                  setSelection(
                    visibleCards.map(card => card.id),
                    event.target.checked
                  )
                }
                ref={input => {
                  if (input)
                    input.indeterminate =
                      pageSelected.length > 0 && !allPageSelected;
                }}
                type="checkbox"
              />
              Tout sélectionner sur cette page
            </label>
            {searchQuery && cards.length > visibleCards.length ? (
              <button
                className="rounded-lg border border-white/15 px-3 py-2 text-slate-200 transition hover:bg-white/5"
                onClick={() =>
                  setSelection(
                    cards.map(card => card.id),
                    true
                  )
                }
                type="button"
              >
                Sélectionner les {cards.length} cartes de ce filtre
              </button>
            ) : null}
          </div>
        ) : null}
        {searchQuery && cards.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-slate-300">
            Aucune carte trouvée avec ce nom ou cette licence.
          </p>
        ) : null}
        {visibleCards.map(card =>
          editingCardId === card.id ? (
            <div className="space-y-2" key={card.id}>
              <button
                className="text-sm text-slate-400 underline transition hover:text-white"
                onClick={() => setEditingCardId(null)}
                type="button"
              >
                Fermer l&apos;édition
              </button>
              <CardRow card={card} categories={categories} />
            </div>
          ) : (
            <article
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3"
              key={card.id}
            >
              <input
                aria-label={`Sélectionner ${card.nom}`}
                checked={selected.has(card.id)}
                className="size-5 shrink-0"
                onChange={event =>
                  setSelection([card.id], event.target.checked)
                }
                type="checkbox"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{card.nom}</p>
                <p className="truncate text-xs text-slate-400">
                  {card.categorie} ·{" "}
                  {card.franchises.join(" · ") || "Sans licence"}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300">
                {card.rarete_base}
              </span>
              <button
                className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
                onClick={() => setEditingCardId(card.id)}
                type="button"
              >
                Modifier
              </button>
            </article>
          )
        )}
        {pageCount > 1 ? (
          <nav
            aria-label="Pagination des cartes administrables"
            className="flex flex-wrap items-center justify-center gap-2 pt-3"
          >
            <button
              className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40"
              disabled={safePage === 1}
              onClick={() => goToPage(safePage - 1)}
              type="button"
            >
              Précédent
            </button>
            <span className="px-2 text-sm text-slate-400">
              Page {safePage} sur {pageCount}
            </span>
            <button
              className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40"
              disabled={safePage === pageCount}
              onClick={() => goToPage(safePage + 1)}
              type="button"
            >
              Suivant
            </button>
          </nav>
        ) : null}
      </section>
      {selectedIds.length ? (
        <div
          aria-label="Actions sur la sélection"
          className="sticky bottom-4 z-10 space-y-3 rounded-2xl border border-red-400/30 bg-slate-950/95 p-4 shadow-xl"
          role="region"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p aria-live="polite" className="flex-1 text-sm font-semibold">
              {selectedIds.length} carte(s) sélectionnée(s)
              {selectedIds.length > MAX_BULK_DELETE_CARDS
                ? ` — maximum ${MAX_BULK_DELETE_CARDS} par suppression`
                : ""}
            </p>
            <button
              className="rounded-lg border border-white/15 px-3 py-2 text-sm"
              onClick={() => setSelected(new Set())}
              type="button"
            >
              Tout désélectionner
            </button>
            <button
              className="rounded-lg border border-red-400/40 px-3 py-2 text-sm font-semibold text-red-200 disabled:opacity-40"
              disabled={
                previewing || selectedIds.length > MAX_BULK_DELETE_CARDS
              }
              onClick={openBulkDelete}
              type="button"
            >
              {previewing ? "Calcul de l’impact…" : "Supprimer"}
            </button>
          </div>
          <Feedback state={bulkError} />
        </div>
      ) : null}
      {bulkPreview ? (
        <BulkDeleteDialog
          ids={bulkPreview.ids}
          onClose={() => setBulkPreview(null)}
          onDeleted={() => {
            setBulkPreview(null);
            setSelected(new Set());
          }}
          preview={bulkPreview.preview}
        />
      ) : null}
    </div>
  );
}
