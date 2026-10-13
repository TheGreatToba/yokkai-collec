"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardReportButton } from "@/components/card-report-button";
import { Button, Karas, Modal } from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import type { Card } from "@/lib/data/cards";
import {
  getCardDiscovery,
  toggleWishlist,
  type CardDiscovery,
  type CardOwner
} from "@/lib/data/wishlist";

function CardOwnerList({
  title,
  owners
}: {
  title: string;
  owners: CardOwner[];
}) {
  return (
    <div className="yk-catalogue-owner-group">
      <h4>{title}</h4>
      {owners.length ? (
        <ul>
          {owners.map(owner => (
            <li key={owner.id}>
              <Link href={`/profil/${owner.id}`} title={owner.pseudo}>
                <span className="yk-catalogue-owner-name">{owner.pseudo}</span>
                <span className="yk-catalogue-owner-copies">
                  {owner.copies} ex.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucun</p>
      )}
    </div>
  );
}

export function CatalogueCardModal({
  selected,
  onClose,
  onWishlistChange
}: {
  selected: Card | null;
  onClose: () => void;
  onWishlistChange?: (cardId: string, wishlisted: boolean) => void;
}) {
  const [discovery, setDiscovery] = useState<{
    cardId: string;
    detail?: CardDiscovery;
    error?: string;
  }>();
  const [busy, setBusy] = useState(false);
  const detail =
    selected && discovery?.cardId === selected.id
      ? discovery.detail
      : undefined;
  const error =
    selected && discovery?.cardId === selected.id ? discovery.error : undefined;

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const cardId = selected.id;
    void getCardDiscovery(cardId).then(
      value => {
        if (active) setDiscovery({ cardId, detail: value });
      },
      caught => {
        if (active)
          setDiscovery({
            cardId,
            error:
              caught instanceof Error ? caught.message : "Détail indisponible."
          });
      }
    );
    return () => {
      active = false;
    };
  }, [selected]);

  async function toggle() {
    if (!selected || busy) return;
    setBusy(true);
    setDiscovery(current =>
      current?.cardId === selected.id
        ? { ...current, error: undefined }
        : current
    );
    try {
      const wishlisted = await toggleWishlist(selected.id);
      setDiscovery(current =>
        current?.cardId === selected.id && current.detail
          ? { ...current, detail: { ...current.detail, wishlisted } }
          : current
      );
      onWishlistChange?.(selected.id, wishlisted);
    } catch (caught) {
      setDiscovery({
        cardId: selected.id,
        detail,
        error: caught instanceof Error ? caught.message : "Action impossible."
      });
    } finally {
      setBusy(false);
    }
  }

  async function moreOwners() {
    if (!selected || !detail) return;
    try {
      const next = await getCardDiscovery(
        selected.id,
        detail.owners.length,
        12
      );
      setDiscovery({
        cardId: selected.id,
        detail: { ...next, owners: [...detail.owners, ...next.owners] }
      });
    } catch (caught) {
      setDiscovery({
        cardId: selected.id,
        detail,
        error:
          caught instanceof Error
            ? caught.message
            : "Possesseurs indisponibles."
      });
    }
  }

  const friendOwners = detail?.owners.filter(owner => owner.isFriend) ?? [];
  const otherOwners = detail?.owners.filter(owner => !owner.isFriend) ?? [];

  return (
    <Modal
      open={!!selected}
      onClose={onClose}
      title={selected?.name ?? "Détail de la carte"}
      className="yk-catalogue-detail-modal"
    >
      {selected && (
        <div className="yk-detail-grid">
          <div className="yk-detail-art">
            <YokaiCard {...selected} />
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="text-sm text-ink-2">
              {selected.category} · {selected.rarity}
            </p>
            <p className="mt-2 text-sm text-ink-3">
              {selected.anime ?? "Franchise non renseignée"}
            </p>
            <p className="mt-7 text-xs text-ink-3">Valeur de marché</p>
            {detail?.marketValue != null ? (
              <Karas
                amount={Math.round(detail.marketValue)}
                className="mt-2 text-xl"
              />
            ) : (
              <p className="mt-2 text-sm text-ink-3">
                Aucune vente enregistrée
              </p>
            )}
            {detail?.activeAuctionId ? (
              <Link
                className="yk-button mt-5 flex w-full justify-center"
                href={`/marche/${detail.activeAuctionId}`}
              >
                Voir l’enchère
              </Link>
            ) : null}
            <Button
              variant="secondary"
              disabled={!detail || busy}
              className="mt-3 w-full"
              onClick={() => void toggle()}
            >
              {detail?.wishlisted
                ? "♥ Retirer de ma wishlist"
                : "♡ Ajouter à ma wishlist"}
            </Button>
            <CardReportButton
              cardId={selected.id}
              cardName={selected.name}
              className="mt-3 w-full"
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <section className="yk-catalogue-owners">
              <h3 className="font-display text-sm">
                Possesseurs actuels {detail ? `(${detail.ownerCount})` : ""}
              </h3>
              {detail?.owners.length ? (
                <div className="yk-catalogue-owner-columns">
                  <CardOwnerList title="Amis" owners={friendOwners} />
                  <CardOwnerList
                    title="Autres utilisateurs"
                    owners={otherOwners}
                  />
                </div>
              ) : detail ? (
                <p>Aucun possesseur actuellement.</p>
              ) : (
                <p>Chargement…</p>
              )}
              {detail && detail.owners.length < detail.ownerCount ? (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => void moreOwners()}
                >
                  Afficher plus
                </Button>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </Modal>
  );
}
