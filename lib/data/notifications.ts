import { readRequest } from "@/lib/data/read-request";
import { createClient } from "@/utils/supabase/client";

export type KnownNotificationType="wishlist_card_on_auction"|"friend_request"|"outbid"|"trade_offer_received"|"trade_counter_offer_received"|"trade_offer_accepted"|"trade_offer_declined"|"trade_offer_cancelled"|"auction_won"|"auction_sold"|"auction_chat_mention"|"achievement_completed";
export type AppNotification={id:string;type:KnownNotificationType|(string&{});referenceId:string;readAt:string|null;createdAt:string;cardName:string|null;actorPseudo:string|null;achievementName:string|null;karaAmount?:number|null};
export class NotificationRequestError extends Error {
  code?: string;
  details?: string;
  hint?: string;
  constructor(message: string, error: {code?:string;details?:string;hint?:string;message?:string}) {
    super(message, {cause:error});
    this.name="NotificationRequestError";
    this.code=error.code;
    this.details=error.details;
    this.hint=error.hint;
  }
}
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();
export async function getNotifications(){const {data,error}=await readRequest(signal => db().rpc("list_notifications",{p_limit:30}).abortSignal(signal));if(error)throw new NotificationRequestError("Impossible de charger les notifications.",error);return data as AppNotification[];}
export async function markNotificationRead(id?:string){const {error}=await db().rpc("mark_notification_read",{p_notification_id:id??null});if(error)throw new NotificationRequestError("Impossible de marquer la notification comme lue.",error);}
