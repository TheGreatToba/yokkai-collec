import { createClient } from "@/utils/supabase/client";

export type WallPost = { id: string; text: string; mediaPath: string | null; gifUrl: string | null; createdAt: string; previewUrl?: string };
export type WallPage = { items: WallPost[]; next: { at: string; id: string } | null };
export type WallAdapter = {
  list: (ownerId: string, cursor?: WallPage["next"]) => Promise<WallPage>;
  publish: (input: { id: string; text: string; mediaPath: string | null; gifUrl: string | null }) => Promise<WallPost>;
  remove: (id: string) => Promise<string | null>;
  upload: (file: File, ownerId: string) => Promise<string>;
  discard: (path: string) => Promise<void>;
};
const messages: Record<string,string> = {
  WALL_PRIVATE: "Ce mur est privé. Seuls ses amis peuvent le consulter.",
  WALL_RATE_LIMITED: "Patiente quelques secondes entre deux publications (30 maximum par heure).",
  WALL_FULL: "Ton mur contient déjà 500 publications. Supprime-en une pour continuer.",
  WALL_POST_INVALID: "Écris jusqu’à 3 000 caractères, ou ajoute une image ou un GIF.",
  WALL_GIF_INVALID: "Choisis un GIF dans le sélecteur.",
  WALL_MEDIA_INVALID: "L’image n’est plus disponible. Choisis-la à nouveau."
};
async function rpc<T>(name: string, args: Record<string,unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name,args);
  if(error) throw new Error(messages[error.message] ?? "Le mur est temporairement indisponible. Réessaie dans un instant.");
  return data as T;
}
export const liveWall: WallAdapter = {
  list: (id,cursor) => rpc("get_profile_wall",{p_owner_id:id,p_before:cursor?.at??null,p_before_id:cursor?.id??null,p_limit:20}),
  publish: input => rpc("publish_profile_wall_post",{p_id:input.id,p_body:input.text,p_media_path:input.mediaPath,p_gif_url:input.gifUrl}),
  remove: id => rpc("delete_profile_wall_post",{p_id:id}),
  upload: async (file,ownerId) => {
    const formats: Record<string,string> = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
    if(!formats[file.type] || file.size>6*1024*1024 || file.size===0) throw new Error("JPG, PNG, WebP ou GIF, 6 Mo maximum.");
    const path=`${ownerId}/${crypto.randomUUID()}.${formats[file.type]}`;
    const {error}=await createClient().storage.from("profile-wall-media").upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw new Error(error.message.includes("WALL_STORAGE_FULL") ? "Ton mur a atteint son quota de 100 Mo d’images. Supprime une ancienne publication illustrée pour continuer." : "Impossible d’envoyer l’image. Ton texte est conservé.");
    return path;
  },
  discard: async path => {
    const {error}=await createClient().storage.from("profile-wall-media").remove([path]);
    if(error) throw new Error("Le fichier n’a pas pu être nettoyé. Réessaie.");
  }
};
