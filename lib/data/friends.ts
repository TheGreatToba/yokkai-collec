import { createClient } from "@/utils/supabase/client";

export type FriendshipStatus = "none"|"incoming"|"outgoing"|"accepted"|"self";
export type FriendUser = {id:string;pseudo:string;status?:FriendshipStatus;requestId?:string;createdAt?:string};
export type Friendships = {friends:FriendUser[];incoming:FriendUser[];outgoing:FriendUser[]};
export type PublicProfile = {id:string;pseudo:string;friendshipStatus:FriendshipStatus};
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();
async function call<T>(name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await db().rpc(name,args);if(error){const messages:Record<string,string>={CANNOT_FRIEND_SELF:"Vous ne pouvez pas vous ajouter vous-même.",PROFILE_NOT_FOUND:"Ce profil est introuvable.",FRIENDSHIP_EXISTS:"Une relation ou une demande existe déjà avec ce joueur.",FRIEND_REQUEST_NOT_FOUND:"Cette demande n’est plus disponible."};throw new Error(messages[error.message]??"Impossible de mettre à jour vos amis.");}return data as T;}
export const searchUsers=(query:string)=>call<FriendUser[]>("search_users",{p_query:query});
export const getFriendships=()=>call<Friendships>("get_friendships");
export const getPublicProfile=(id:string)=>call<PublicProfile>("get_public_profile",{p_user_id:id});
export const sendFriendRequest=(id:string)=>call<string>("send_friend_request",{p_friend_id:id});
export const respondFriendRequest=(id:string,accept:boolean)=>call<boolean>("respond_friend_request",{p_request_id:id,p_accept:accept});
