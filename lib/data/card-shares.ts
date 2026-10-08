import { createClient } from "@/utils/supabase/client";

export type CardShare = {
  id: string;
  cardName: string;
  rarity: string;
  shiny: boolean;
  showPseudo: boolean;
  createdAt: string;
};

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Connecte-toi pour gérer tes liens.",
      CARD_NOT_OWNED: "Tu ne possèdes plus cet exemplaire.",
      CARD_SHARE_DAILY_LIMIT: "Tu as atteint la limite de 10 nouveaux liens par jour UTC.",
    };
    throw new Error(messages[error.message] ?? "Les liens partagés sont momentanément indisponibles.");
  }
  return data as T;
}

export const createCardShare = (instanceId: string, showPseudo: boolean) =>
  call<string>("create_card_share", { p_instance_id: instanceId, p_show_pseudo: showPseudo });
export const deleteCardShare = (id: string) =>
  call<boolean>("delete_card_share", { p_share_id: id });
export const listCardShares = (offset = 0) =>
  call<CardShare[]>("list_card_shares", { p_offset: offset });

export function cardShareUrl(id: string) {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error("Lien de partage invalide.");
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("L’adresse publique du site est indisponible.");
  return new URL(`/partage/${id}`, origin).href;
}
