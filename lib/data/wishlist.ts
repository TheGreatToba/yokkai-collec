import { createClient } from "@/utils/supabase/client";
import type { Card } from "@/lib/data/cards";

export type CardOwner={id:string;pseudo:string;copies:number};
export type CardDiscovery={card:Card;marketValue:number|null;activeAuctionId:string|null;wishlisted:boolean;ownerCount:number;owners:CardOwner[]};
export type WishlistCard=Card&{createdAt:string};
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();
async function call<T>(name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await db().rpc(name,args);if(error){const messages:Record<string,string>={CARD_ALREADY_OWNED:"Cette carte est déjà dans votre collection.",CARD_NOT_FOUND:"Cette carte est introuvable."};throw new Error(messages[error.message]??"La wishlist est momentanément indisponible.");}return data as T;}
export const getCardDiscovery=(cardId:string,offset=0,limit=12)=>call<CardDiscovery>("get_card_discovery",{p_card_id:cardId,p_owner_offset:offset,p_owner_limit:limit});
export const toggleWishlist=(cardId:string)=>call<boolean>("toggle_wishlist",{p_card_id:cardId});
export const getWishlist=(identifier?:string)=>call<WishlistCard[]>("list_wishlist",{p_identifier:identifier??null});
