import { createClient } from "@/utils/supabase/client";

export type FriendshipStatus = "none"|"incoming"|"outgoing"|"accepted"|"self";
export type FriendUser = {id:string;pseudo:string;avatarUrl?:string|null;status?:FriendshipStatus;requestId?:string;createdAt?:string};
export type Friendships = {friends:FriendUser[];incoming:FriendUser[];outgoing:FriendUser[]};
export type PublicProfile = {id:string;pseudo:string;friendshipStatus:FriendshipStatus};
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();

type SupabaseFailure={message?:string;code?:string;details?:string;hint?:string;status?:number;statusCode?:number|string};
class FriendsError extends Error { constructor(message:string,readonly reason?:string){super(message);this.name="FriendsError";} }

const businessMessages:Record<string,string>={
  CANNOT_FRIEND_SELF:"Vous ne pouvez pas vous ajouter vous-même.",
  PROFILE_NOT_FOUND:"Ce profil est introuvable.",
  FRIEND_REQUEST_NOT_FOUND:"Cette demande n’est plus disponible.",
  FRIENDSHIP_NOT_FOUND:"Cette relation d’amitié n’est plus disponible.",
  FRIENDSHIP_EXISTS:"Une relation ou une demande existe déjà avec ce joueur.",
};

function details(error:unknown):SupabaseFailure{
  if(error&&typeof error==="object")return error as SupabaseFailure;
  return {message:typeof error==="string"?error:"Erreur inconnue"};
}

function logFailure(rpc:string,error:unknown){
  if(process.env.NODE_ENV==="production")return;
  const failure=details(error);
  console.error(`[friends] RPC ${rpc} failed`,{code:failure.code,status:failure.status??failure.statusCode,message:failure.message,details:failure.details,hint:failure.hint});
}

function friendlyFailure(error:unknown){
  const failure=details(error);const status=Number(failure.status??failure.statusCode);const message=failure.message??"";
  if(message in businessMessages)return new FriendsError(businessMessages[message],message);
  if(status===401||status===403||failure.code==="PGRST301"||failure.code==="42501"||/unauthori[sz]ed|forbidden|permission denied|row-level security/i.test(message))
    return new FriendsError("Vous n’êtes pas autorisé à effectuer cette action. Reconnectez-vous puis réessayez.","AUTHORIZATION");
  if(error instanceof TypeError||/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message))
    return new FriendsError("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.","NETWORK");
  return new FriendsError("Le service des amis est momentanément indisponible. Réessayez dans un instant.",failure.code);
}

async function call<T>(name:string,args?:Record<string,unknown>):Promise<T>{
  let result:Awaited<ReturnType<ReturnType<typeof db>["rpc"]>>;
  try{result=await db().rpc(name,args);}catch(error){logFailure(name,error);throw friendlyFailure(error);}
  if(result.error){logFailure(name,result.error);throw friendlyFailure(result.error);}
  return result.data as T;
}
export const searchUsers=(query:string)=>call<FriendUser[]>("search_users",{p_query:query});
export const getFriendships=()=>call<Friendships>("get_friendships");
export const getPublicProfile=(id:string)=>call<PublicProfile>("get_public_profile",{p_user_id:id});
export async function sendFriendRequest(id:string){
  try{return await call<string>("send_friend_request",{p_friend_id:id});}
  catch(error){
    if(!(error instanceof FriendsError)||error.reason!=="FRIENDSHIP_EXISTS")throw error;
    try{
      const current=await getFriendships();
      if(current.friends.some(friend=>friend.id===id))throw new FriendsError("Vous êtes déjà amis avec ce joueur.","ALREADY_FRIENDS");
      if(current.outgoing.some(friend=>friend.id===id))throw new FriendsError("Une demande d’ami a déjà été envoyée à ce joueur.","REQUEST_ALREADY_SENT");
      if(current.incoming.some(friend=>friend.id===id))throw new FriendsError("Ce joueur vous a déjà envoyé une demande d’ami.","REQUEST_ALREADY_RECEIVED");
    }catch(lookupError){if(lookupError instanceof FriendsError&&lookupError.reason!=="FRIENDSHIP_EXISTS")throw lookupError;}
    throw error;
  }
}
export const respondFriendRequest=(id:string,accept:boolean)=>call<boolean>("respond_friend_request",{p_request_id:id,p_accept:accept});
export const removeFriend=(id:string)=>call<boolean>("remove_friend",{p_friend_id:id});
