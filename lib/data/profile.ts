import { readRequest } from "@/lib/data/read-request";
import { createClient } from "@/utils/supabase/client";
import { withLiveCardFranchises, type Card, type CollectedCard, type PaniniAlbumCardPage, type PaniniAlbumPage } from "@/lib/data/cards";
import type { FriendUser, FriendshipStatus } from "@/lib/data/friends";
import { publishPlayerSnapshotInvalidation } from "@/lib/data/player-state";

export type Profile = {id:string;pseudo:string;avatarUrl:string|null;bio:string;bannerCard:Card|null;friendshipStatus:FriendshipStatus;isPublic:boolean;canViewCollection:boolean;featuredCards:CollectedCard[];friends:(FriendUser&{avatarUrl?:string|null})[];friendsVisible:boolean;cardCount:number|null;distinctCardCount:number|null};
export type ProfileInterests = { anime: string[]; games: string[]; kpop: string[]; other: string[] };
export type ProfileWidget = { category: string; entries: string[] };
export type ProfileDetails = {
  joinedAt: string | null;
  interests: ProfileInterests;
  widgets: ProfileWidget[];
  widgetCategories: string[];
  bannerUrl: string | null;
  boostersOpened: number | null;
  lrCount: number | null;
  ssrCount: number | null;
  mutualFriends: FriendUser[];
  favoriteAlbums: { license: string; total: number; owned: number; percent: number }[];
  activity: { id: string; kind: "obtained" | "bought" | "sold"; at: string; price?: number; card: Card }[];
};
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();
function fail(error:{message?:string}) { const messages:Record<string,string>={PROFILE_NOT_FOUND:"Ce profil est introuvable.",BIO_TOO_LONG:"La bio ne peut pas dépasser 300 caractères.",AVATAR_URL_INVALID:"URL non autorisée. Utilisez le bouton pour envoyer votre avatar (2 048 caractères maximum).",FEATURED_CARDS_INVALID:"Choisissez au maximum cinq cartes différentes.",CARD_NOT_OWNED:"Une carte sélectionnée n’est plus dans votre collection.",FRIENDS_ONLY:"La collection complète est réservée aux amis.",PROFILE_PRIVATE:"Ce profil est privé. Seuls ses amis peuvent voir sa collection."};return new Error(messages[error.message??""]??"Impossible de charger les données du profil."); }
async function hydrateProfile(profile:Profile, bounded = false){const bannerCard=profile.bannerCard?(await withLiveCardFranchises([profile.bannerCard], bounded))[0]:null;const featuredCards=await withLiveCardFranchises(profile.featuredCards, bounded);const friendsVisible=profile.friendsVisible??profile.friendshipStatus==="self";const friends=friendsVisible&&Array.isArray(profile.friends)?profile.friends:[];return {...profile,bannerCard,featuredCards,friends,friendsVisible};}
export async function getProfile(identifier?:string){const {data,error}=await readRequest(signal => db().rpc("get_profile",{p_identifier:identifier??null}).abortSignal(signal));if(error)throw fail(error);return hydrateProfile(data as Profile, true);}
export async function getProfileDetails(identifier?: string): Promise<ProfileDetails> {
  const {data,error} = await readRequest(signal => db().rpc("get_profile_details", {p_identifier: identifier ?? null}).abortSignal(signal));
  if (error) throw fail(error);
  return data as ProfileDetails;
}
export async function saveProfileInterests(interests: ProfileInterests): Promise<ProfileInterests> {
  const {data,error} = await db().rpc("update_profile_interests", {p_interests: interests});
  if (error) throw new Error("Impossible d’enregistrer le tableau. Limitez chaque section à 12 titres de 100 caractères.");
  publishPlayerSnapshotInvalidation(["profile"]);
  return data as ProfileInterests;
}
export async function saveProfileWidgets(widgets: ProfileWidget[]): Promise<ProfileWidget[]> {
  const {data,error} = await db().rpc("update_profile_widgets", {p_widgets: widgets});
  if (error) throw new Error("Impossible d’enregistrer les widgets. Choisissez jusqu’à 12 catégories du jeu, avec 12 titres de 100 caractères chacune.");
  publishPlayerSnapshotInvalidation(["profile"]);
  return data as ProfileWidget[];
}
export async function saveProfileAppearance(bio: string, avatarUrl: string | null, featuredIds: string[], bannerCardId: string | null, bannerUrl: string | null): Promise<Profile & {bannerUrl: string | null}> {
  const {data,error} = await db().rpc("update_profile_appearance", {p_bio:bio,p_avatar_url:avatarUrl,p_featured_card_ids:featuredIds,p_banner_card_id:bannerCardId,p_banner_url:bannerUrl});
  if (error) throw error.message === "BANNER_URL_INVALID" ? new Error("Bannière non autorisée. Importez une image depuis votre appareil.") : fail(error);
  const profile = await hydrateProfile(data as Profile & {bannerUrl: string | null});
  publishPlayerSnapshotInvalidation(["profile"]);
  return profile as Profile & {bannerUrl: string | null};
}
export async function uploadBanner(file: File, userId: string) {
  if (file.size > 2*1024*1024) throw new Error("La bannière ne doit pas dépasser 2 Mo.");
  const formats: Record<string,string> = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
  const extension = formats[file.type];
  if (!extension) throw new Error("Format accepté : JPG, PNG, WebP ou GIF.");
  const path = `${userId}/banner.${extension}`;
  const {error} = await db().storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if (error) throw new Error("L’envoi de la bannière a échoué. Réessayez après actualisation.");
  return `${db().storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}
export async function getFriendCollection(friendId:string){const {data,error}=await readRequest(signal=>db().rpc("get_friend_collection",{p_friend_id:friendId}).abortSignal(signal));if(error)throw fail(error);return data as CollectedCard[];}
export async function getFriendPaniniAlbumsPage(friendId:string,{query="",category="",page=1,pageSize=72}:{query?:string;category?:string;page?:number;pageSize?:number}={}):Promise<PaniniAlbumPage>{const safePage=Math.max(1,Math.trunc(page));const safePageSize=Math.min(72,Math.max(1,Math.trunc(pageSize)));const {data,error}=await readRequest(signal=>db().rpc("get_friend_panini_albums_page",{p_friend_id:friendId,p_query:query,p_category:category,p_offset:(safePage-1)*safePageSize,p_limit:safePageSize}).abortSignal(signal));if(error)throw fail(error);const result=data as PaniniAlbumPage|null;return {items:result?.items??[],total:result?.total??0};}
export async function getFriendPaniniAlbumCardsPage(friendId:string,{license,query="",category="",ownedOnly=false,page=1,pageSize=24}:{license:string;query?:string;category?:string;ownedOnly?:boolean;page?:number;pageSize?:number}):Promise<PaniniAlbumCardPage>{const safePage=Math.max(1,Math.trunc(page));const safePageSize=Math.min(60,Math.max(1,Math.trunc(pageSize)));const {data,error}=await readRequest(signal=>db().rpc("get_friend_panini_album_cards_page",{p_friend_id:friendId,p_license:license,p_query:query,p_category:category,p_owned_only:ownedOnly,p_offset:(safePage-1)*safePageSize,p_limit:safePageSize}).abortSignal(signal));if(error)throw fail(error);const result=data as PaniniAlbumCardPage|null;return {items:result?.items??[],total:result?.total??0};}
export async function saveProfile(bio:string,avatarUrl:string|null,featuredIds:string[],bannerCardId:string|null){const {data,error}=await db().rpc("update_profile",{p_bio:bio,p_avatar_url:avatarUrl,p_featured_card_ids:featuredIds,p_banner_card_id:bannerCardId});if(error)throw fail(error);const profile=await hydrateProfile(data as Profile);publishPlayerSnapshotInvalidation(["profile"]);return profile;}
export async function uploadAvatar(file:File,userId:string){if(file.size>2*1024*1024)throw new Error("L’image ne doit pas dépasser 2 Mo.");if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))throw new Error("Format accepté : JPG, PNG, WebP ou GIF.");const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${userId}/avatar.${ext}`;const {error}=await db().storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(error){console.error("Avatar upload failed",{message:error.message,statusCode:"statusCode" in error?error.statusCode:undefined});throw new Error(error.message.includes("row-level security")?"L’accès au stockage de l’avatar a été refusé. Réessayez après actualisation.":"L’envoi de la photo a échoué. Vérifiez le format et réessayez.");}return `${db().storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;}
