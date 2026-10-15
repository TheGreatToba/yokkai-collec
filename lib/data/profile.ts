import { readRequest } from "@/lib/data/read-request";
import { createClient } from "@/utils/supabase/client";
import { withLiveCardFranchises, type Card, type CollectedCard, type PaniniAlbumCardPage, type PaniniAlbumPage, type Rarity } from "@/lib/data/cards";
import type { FriendUser, FriendshipStatus } from "@/lib/data/friends";
import { publishPlayerSnapshotInvalidation } from "@/lib/data/player-state";
import type { BannerFrame } from "@/lib/ui/banner-frame";

export type Profile = {id:string;pseudo:string;avatarUrl:string|null;bio:string;bannerCard:Card|null;friendshipStatus:FriendshipStatus;isPublic:boolean;canViewCollection:boolean;featuredCards:CollectedCard[];friends:(FriendUser&{avatarUrl?:string|null})[];friendsVisible:boolean;cardCount:number|null;distinctCardCount:number|null};
export type ProfileInterests = { anime: string[]; games: string[]; kpop: string[]; other: string[] };
export type ProfileWidget = { category: string; entries: string[] };
export type ProfileLicensePage = {items: string[]; total: number};
export type ProfileEngagement = {likes:number;likedByMe:boolean};
export async function getProfileEngagement(ownerId:string): Promise<ProfileEngagement> {
  const {data,error} = await readRequest(signal => db().rpc("get_profile_engagement",{p_owner_id:ownerId}).abortSignal(signal));
  if (error) throw new Error("Likes are temporarily unavailable.");
  return data as ProfileEngagement;
}
export async function setProfileLike(ownerId:string,liked:boolean): Promise<ProfileEngagement> {
  const {data,error} = await db().rpc("set_profile_like",{p_owner_id:ownerId,p_liked:liked});
  if (error) throw new Error("Couldn't update this profile like. Please try again in a moment.");
  return data as ProfileEngagement;
}
export type ProfileDetails = {
  joinedAt: string | null;
  interests: ProfileInterests;
  widgets: ProfileWidget[];
  widgetCategories: string[];
  bannerUrl: string | null;
  bannerFrame?: BannerFrame | null;
  boostersOpened: number | null;
  lrCount: number | null;
  ssrCount: number | null;
  mutualFriends: FriendUser[];
  favoriteAlbums: { license: string; total: number; owned: number; percent: number }[];
  activity: { id: string; kind: "obtained" | "bought" | "sold"; at: string; price?: number; card: Card }[];
};
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();
function fail(error:{message?:string}) { const messages:Record<string,string>={PROFILE_NOT_FOUND:"This profile couldn't be found.",BIO_TOO_LONG:"Your bio can contain up to 300 characters.",AVATAR_URL_INVALID:"This URL is not allowed. Use the button to upload your avatar (up to 2,048 characters).",FEATURED_CARDS_INVALID:"Choose up to five different cards.",CARD_NOT_OWNED:"This card is no longer in your collection.",FRIENDS_ONLY:"Only friends can view the full collection.",PROFILE_PRIVATE:"This profile is private. Only friends can view its collection."};return new Error(messages[error.message??""]??"Couldn't load profile data."); }
async function hydrateProfile(profile:Profile, bounded = false){const bannerCard=profile.bannerCard?(await withLiveCardFranchises([profile.bannerCard], bounded))[0]:null;const featuredCards=await withLiveCardFranchises(profile.featuredCards, bounded);const friendsVisible=profile.friendsVisible??profile.friendshipStatus==="self";const friends=friendsVisible&&Array.isArray(profile.friends)?profile.friends:[];return {...profile,bannerCard,featuredCards,friends,friendsVisible};}
export async function getProfile(identifier?:string){const {data,error}=await readRequest(signal => db().rpc("get_profile",{p_identifier:identifier??null}).abortSignal(signal));if(error)throw fail(error);return hydrateProfile(data as Profile, true);}
export async function getProfileDetails(identifier?: string): Promise<ProfileDetails> {
  const {data,error} = await readRequest(signal => db().rpc("get_profile_details", {p_identifier: identifier ?? null}).abortSignal(signal));
  if (error) throw fail(error);
  return data as ProfileDetails;
}
export async function saveProfileInterests(interests: ProfileInterests): Promise<ProfileInterests> {
  const {data,error} = await db().rpc("update_profile_interests", {p_interests: interests});
  if (error) throw new Error("Couldn't save your dashboard. Each section can contain up to 12 titles of 100 characters.");
  publishPlayerSnapshotInvalidation(["profile"]);
  return data as ProfileInterests;
}
export async function saveProfileWidgets(widgets: ProfileWidget[]): Promise<ProfileWidget[]> {
  const {data,error} = await db().rpc("update_profile_widgets", {p_widgets: widgets});
  if (error) throw new Error("Couldn't save your widgets. Choose up to 12 catalog franchises per category; a franchise may have been renamed or removed.");
  publishPlayerSnapshotInvalidation(["profile"]);
  return data as ProfileWidget[];
}
export async function getProfileWidgetLicenses({category,query="",page=1}: {category:string;query?:string;page?:number}): Promise<ProfileLicensePage> {
  const {data,error} = await readRequest(signal => db().rpc("get_profile_widget_licenses", {p_category:category,p_query:query,p_offset:(Math.max(1,Math.trunc(page))-1)*72,p_limit:72}).abortSignal(signal));
  if (error) throw new Error("Couldn't load franchises. Please try again in a moment.");
  const result = data as ProfileLicensePage | null;
  return {items:result?.items??[],total:result?.total??0};
}
export async function saveProfileAppearance(bio: string, avatarUrl: string | null, featuredIds: string[], bannerCardId: string | null, bannerUrl: string | null, bannerFrame?: BannerFrame | null): Promise<Profile & {bannerUrl: string | null; bannerFrame?: BannerFrame | null}> {
  const {data,error} = await db().rpc(bannerFrame === undefined ? "update_profile_appearance" : "update_profile_appearance_framed", {p_bio:bio,p_avatar_url:avatarUrl,p_featured_card_ids:featuredIds,p_banner_card_id:bannerCardId,p_banner_url:bannerUrl,...(bannerFrame === undefined ? {} : {p_banner_frame:bannerFrame})});
  if (error?.code === "PGRST202" && bannerFrame !== undefined) throw new Error("Banner framing is not available yet. Please try again after the update.");
  if (error?.message === "BANNER_FRAME_INVALID") throw new Error("This banner crop is invalid. Adjust the image and try again.");
  if (error) throw error.message === "BANNER_URL_INVALID" ? new Error("This banner is not allowed. Upload an image from your device.") : fail(error);
  const profile = await hydrateProfile(data as Profile & {bannerUrl: string | null; bannerFrame?: BannerFrame | null});
  publishPlayerSnapshotInvalidation(["profile"]);
  return profile as Profile & {bannerUrl: string | null};
}
export const PROFILE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export async function uploadBanner(file: File, userId: string) {
  if (file.size > PROFILE_IMAGE_MAX_BYTES) throw new Error("Your banner must be 4 MB or smaller.");
  const formats: Record<string,string> = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
  const extension = formats[file.type];
  if (!extension) throw new Error("Use a JPG, PNG, WebP or GIF image.");
  const path = `${userId}/banner.${extension}`;
  const {error} = await db().storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if (error) throw new Error("Couldn't upload your banner. Refresh the page and try again.");
  return `${db().storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}
export async function getFriendCollection(friendId:string){const {data,error}=await readRequest(signal=>db().rpc("get_friend_collection",{p_friend_id:friendId}).abortSignal(signal));if(error)throw fail(error);return data as CollectedCard[];}
export async function getFriendPaniniAlbumsPage(friendId:string,{query="",category="",page=1,pageSize=72}:{query?:string;category?:string;page?:number;pageSize?:number}={}):Promise<PaniniAlbumPage>{const safePage=Math.max(1,Math.trunc(page));const safePageSize=Math.min(72,Math.max(1,Math.trunc(pageSize)));const {data,error}=await readRequest(signal=>db().rpc("get_friend_panini_albums_page",{p_friend_id:friendId,p_query:query,p_category:category,p_offset:(safePage-1)*safePageSize,p_limit:safePageSize}).abortSignal(signal));if(error)throw fail(error);const result=data as PaniniAlbumPage|null;return {items:result?.items??[],total:result?.total??0};}
export async function getFriendPaniniAlbumCardsPage(friendId:string,{license,query="",category="",rarity="",ownedOnly=false,page=1,pageSize=24}:{license:string;query?:string;category?:string;rarity?:Rarity|"";ownedOnly?:boolean;page?:number;pageSize?:number}):Promise<PaniniAlbumCardPage>{const safePage=Math.max(1,Math.trunc(page));const safePageSize=Math.min(60,Math.max(1,Math.trunc(pageSize)));const {data,error}=await readRequest(signal=>db().rpc("get_friend_panini_album_cards_page",{p_friend_id:friendId,p_license:license,p_query:query,p_category:category,p_owned_only:ownedOnly,p_offset:(safePage-1)*safePageSize,p_limit:safePageSize,...(rarity?{p_rarity:rarity}:{})}).abortSignal(signal));if(error)throw fail(error);const result=data as PaniniAlbumCardPage|null;return {items:result?.items??[],total:result?.total??0};}
export async function saveProfile(bio:string,avatarUrl:string|null,featuredIds:string[],bannerCardId:string|null){const {data,error}=await db().rpc("update_profile",{p_bio:bio,p_avatar_url:avatarUrl,p_featured_card_ids:featuredIds,p_banner_card_id:bannerCardId});if(error)throw fail(error);const profile=await hydrateProfile(data as Profile);publishPlayerSnapshotInvalidation(["profile"]);return profile;}
export async function uploadAvatar(file:File,userId:string){if(file.size>PROFILE_IMAGE_MAX_BYTES)throw new Error("Your profile photo must be 4 MB or smaller.");if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))throw new Error("Use a JPG, PNG, WebP or GIF image.");const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";const path=`${userId}/avatar.${ext}`;const {error}=await db().storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(error){console.error("Avatar upload failed",{message:error.message,statusCode:"statusCode" in error?error.statusCode:undefined});throw new Error(error.message.includes("row-level security")?"Profile photo storage access was denied. Refresh the page and try again.":"Couldn't upload your profile photo. Check the format and try again.");}return `${db().storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;}
