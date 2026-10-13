"use server";

import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAdminAction } from "@/lib/auth/admin";
import { createClient } from "@/utils/supabase/server";
import {
  downloadImage,
  deriveSourceId,
  imagePath,
  imageUrlFromCsvRow,
  importCards,
  validateCard,
  validateImageBytes
} from "@/scripts/import-cards.mjs";

export type AdminActionState = {
  ok: boolean;
  message: string;
  details?: string[];
};

const initialFailure = (
  message: string,
  details?: string[]
): AdminActionState => ({
  ok: false,
  message,
  details
});
const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const MAX_FRANCHISES = 10;
const CATEGORY_ALBUMS = new Set([
  "ARTIST",
  "DISNEY CHANNEL",
  "FILM",
  "INTERNET PERSONALITY",
  "KPOP",
  "WWE"
]);

function franchiseInputs(form: FormData) {
  const franchises: string[] = [];
  const seen = new Set<string>();
  for (const entry of form.getAll("franchise")) {
    const franchise = String(entry).trim();
    if (!franchise) continue;
    if (franchise.length > 200)
      throw new Error("Une licence ne peut pas dépasser 200 caractères.");
    const key = franchise.toLocaleLowerCase("fr-FR");
    if (seen.has(key)) continue;
    seen.add(key);
    franchises.push(franchise);
  }
  if (franchises.length > MAX_FRANCHISES)
    throw new Error(`Maximum ${MAX_FRANCHISES} licences par carte.`);
  return franchises;
}

function albumFranchises(franchises: string[], category: string) {
  if (franchises.length) return franchises;
  const normalizedCategory = category.trim().toUpperCase();
  return CATEGORY_ALBUMS.has(normalizedCategory) ? [normalizedCategory] : [];
}
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function normalizeCsvRow(row: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, cell]) => [
      key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      cell
    ])
  );
}

function cardInput(form: FormData, franchises: string[]) {
  return validateCard({
    source_id: value(form, "source_id"),
    nom: value(form, "nom"),
    categorie: value(form, "categorie"),
    franchise: franchises[0] ?? "",
    franchise_romaji: "",
    image_url: value(form, "image_url") || "https://local.invalid/upload",
    favoris_count: "",
    rarete_base: value(form, "rarete_base"),
    source: "manual"
  });
}

async function imageForCard(
  form: FormData,
  card: ReturnType<typeof validateCard>
) {
  const file = form.get("image_file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("L’image dépasse 6 Mio.");
    if (!ALLOWED_MIME.has(file.type))
      throw new Error("Format d’image non pris en charge.");
    const bytes = Buffer.from(await file.arrayBuffer());
    validateImageBytes(bytes, file.type);
    return { bytes, contentType: file.type };
  }
  if (card.image_url.includes("local.invalid"))
    throw new Error("Ajoute un fichier image ou une URL HTTPS.");
  return downloadImage(card.image_url);
}

type AuthenticatedClient = ReturnType<typeof createClient>;

async function syncCategory(
  client: AuthenticatedClient,
  cardId: string,
  category: string
) {
  const { error: deleteError } = await client
    .from("card_categories")
    .delete()
    .eq("card_id", cardId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await client.from("card_categories").insert({
    card_id: cardId,
    categorie: category
  });
  if (insertError) throw insertError;
}

async function syncFranchises(
  client: AuthenticatedClient,
  cardId: string,
  franchises: string[]
) {
  const { error: deleteError } = await client
    .from("card_franchises")
    .delete()
    .eq("card_id", cardId);
  if (deleteError) throw deleteError;
  if (!franchises.length) return;
  const { error: insertError } = await client.from("card_franchises").insert(
    franchises.map((franchise, position) => ({
      card_id: cardId,
      franchise,
      position
    }))
  );
  if (insertError) throw insertError;
}

export async function createCardAction(
  _previous: AdminActionState,
  form: FormData
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminAction();
    const client = createClient(await cookies());
    const franchises = franchiseInputs(form);
    const card = cardInput(form, franchises);
    const image = await imageForCard(form, card);
    const path = imagePath(card);
    const { error: uploadError } = await client.storage
      .from("card-images")
      .upload(path, image.bytes, {
        contentType: image.contentType,
        upsert: true,
        cacheControl: "3600"
      });
    if (uploadError) throw uploadError;
    card.image_url = client.storage
      .from("card-images")
      .getPublicUrl(path).data.publicUrl;
    const { data, error } = await client
      .from("cards")
      .upsert(card, {
        onConflict: "source,source_id",
        defaultToNull: false
      })
      .select(
        "id,source_id,nom,categorie,franchise,rarete_base,image_url,source"
      )
      .single();
    if (error) throw error;
    await syncCategory(client, data.id, data.categorie);
    await syncFranchises(
      client,
      data.id,
      albumFranchises(franchises, data.categorie)
    );
    const { error: auditError } = await client.from("admin_audit_logs").insert({
      admin_user_id: admin.id,
      action: "card.create",
      card_id: data.id,
      card_snapshot: { ...data, franchises }
    });
    if (auditError) throw auditError;
    revalidatePath("/admin/cards");
    return { ok: true, message: `${data.nom} a été mise en ligne.` };
  } catch (error) {
    return initialFailure(
      error instanceof Error ? error.message : "Création impossible."
    );
  }
}

export async function importCardsAction(
  _previous: AdminActionState,
  form: FormData
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminAction();
    const file = form.get("csv");
    if (!(file instanceof File) || !file.size)
      throw new Error("Choisis un fichier CSV.");
    if (file.size > 1024 * 1024) throw new Error("Le CSV dépasse 1 Mio.");
    const records = parse(await file.text(), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      max_record_size: 1024 * 1024
    }) as Record<string, string>[];
    if (!records.length) throw new Error("Le CSV est vide.");
    if (records.length > 500) throw new Error("Maximum 500 cartes par import.");
    const rows = records.map(rawRow => {
      const row = normalizeCsvRow(rawRow);
      const sourceId = (row.source_id || row.identifiant || "").trim();
      const card = {
        source_id: sourceId,
        nom: row.nom ?? row.name ?? row.personnage ?? row.character ?? "",
        categorie: row.categorie ?? row.category ?? "",
        franchise: row.franchise ?? row.licence ?? row.anime ?? "",
        franchise_romaji: row.franchise_romaji ?? "",
        image_url: imageUrlFromCsvRow(row).replace(/^http:\/\//i, "https://"),
        favoris_count: row.favoris_count ?? "",
        rarete_base: row.rarete_base ?? row.rarete ?? row.rarity ?? "",
        // validateCard generates a deterministic ID for manual rows. An admin
        // CSV without source_id is therefore safely rerunnable without duplicates.
        source: sourceId ? row.source || "manual" : "manual"
      };
      if (!card.source_id) card.source_id = deriveSourceId(card);
      return card;
    });
    const client = createClient(await cookies());
    const failures: string[] = [];
    const stats = await importCards({
      rows,
      client,
      bucket: "card-images",
      batchSize: 25,
      concurrency: 2,
      log: () => {},
      onFailure: async (failure: { record: number; message: string }) => {
        const cardName = rows[failure.record - 1]?.nom.trim();
        const cardLabel = cardName ? `Carte « ${cardName} »` : "Carte sans nom";
        failures.push(
          `${cardLabel} (ligne ${failure.record}): ${failure.message}`
        );
      }
    });
    const { error: auditError } = await client.from("admin_audit_logs").insert({
      admin_user_id: admin.id,
      action: "card.import",
      metadata: { filename: file.name, ...stats }
    });
    if (auditError) throw auditError;
    revalidatePath("/admin/cards");
    return {
      ok: true,
      message: `${stats.imported} carte(s) importée(s), ${stats.skipped} refusée(s).`,
      details: failures.slice(0, 20)
    };
  } catch (error) {
    return initialFailure(
      error instanceof Error ? error.message : "Import impossible."
    );
  }
}

export async function updateCardAction(
  _previous: AdminActionState,
  form: FormData
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminAction();
    const id = value(form, "id");
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error("Identifiant de carte invalide.");
    const franchises = franchiseInputs(form);
    const patch: {
      nom: string;
      categorie: string;
      franchise: string;
      rarete_base: string;
      image_url?: string;
    } = {
      nom: value(form, "nom"),
      categorie: value(form, "categorie"),
      franchise: franchises[0] ?? "",
      rarete_base: value(form, "rarete_base")
    };
    if (!patch.nom || !patch.categorie)
      throw new Error("Le nom et la catégorie sont requis.");
    if (!["C", "R", "SR", "SSR", "LR"].includes(patch.rarete_base))
      throw new Error("Rareté invalide.");
    const client = createClient(await cookies());
    const { data: current, error: readError } = await client
      .from("cards")
      .select("id,source,source_id,image_url")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    const imageUrl = value(form, "image_url");
    const imageFile = form.get("image_file");
    if (imageUrl || (imageFile instanceof File && imageFile.size > 0)) {
      const imageCard = {
        ...current,
        ...patch,
        image_url: imageUrl || current.image_url
      } as ReturnType<typeof validateCard>;
      const image = await imageForCard(form, imageCard);
      // A replacement must get a new public URL. Overwriting the stable import
      // path leaves browsers and the Storage CDN serving the previous image
      // until cacheControl expires.
      const path = `${imagePath(imageCard)}-${randomUUID()}`;
      const { error: uploadError } = await client.storage
        .from("card-images")
        .upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: true,
          cacheControl: "3600"
        });
      if (uploadError) throw uploadError;
      patch.image_url = client.storage
        .from("card-images")
        .getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await client
      .from("cards")
      .update(patch)
      .eq("id", id)
      .select(
        "id,source_id,nom,categorie,franchise,rarete_base,image_url,source"
      )
      .single();
    if (error) throw error;
    await syncCategory(client, id, patch.categorie);
    await syncFranchises(
      client,
      id,
      albumFranchises(franchises, patch.categorie)
    );
    const { error: auditError } = await client.from("admin_audit_logs").insert({
      admin_user_id: admin.id,
      action: "card.update",
      card_id: id,
      card_snapshot: { ...data, franchises }
    });
    if (auditError) throw auditError;
    revalidatePath("/admin/cards");
    return { ok: true, message: `${data.nom} a été modifiée.` };
  } catch (error) {
    return initialFailure(
      error instanceof Error ? error.message : "Modification impossible."
    );
  }
}

export async function deleteCardAction(
  _previous: AdminActionState,
  form: FormData
): Promise<AdminActionState> {
  try {
    await requireAdminAction();
    const id = value(form, "id");
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error("Identifiant de carte invalide.");
    const client = createClient(await cookies());
    const { data, error } = await client.rpc("admin_delete_card", {
      p_card_id: id
    });
    if (error) throw error;
    const result = data as {
      name?: string;
      ownedCopiesRemoved?: number;
      auctionsCancelled?: number;
      pendingTradesDeclined?: number;
    } | null;
    revalidatePath("/admin/cards");
    return {
      ok: true,
      message:
        `${result?.name ?? "La carte"} a été supprimée avec ` +
        `${Number(result?.ownedCopiesRemoved ?? 0)} copie(s), ` +
        `${Number(result?.auctionsCancelled ?? 0)} enchère(s) et ` +
        `${Number(result?.pendingTradesDeclined ?? 0)} échange(s) en attente.`
    };
  } catch (error) {
    return initialFailure(
      error instanceof Error ? error.message : "Suppression impossible."
    );
  }
}
