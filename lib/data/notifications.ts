import { createClient } from "@/utils/supabase/client";

export type AppNotification={id:string;type:"wishlist_card_on_auction";referenceId:string;readAt:string|null;createdAt:string;cardName:string};
let client:ReturnType<typeof createClient>|undefined;
const db=()=>client??=createClient();
export async function getNotifications(){const {data,error}=await db().rpc("list_notifications",{p_limit:30});if(error)throw new Error("Impossible de charger les notifications.");return data as AppNotification[];}
export async function markNotificationRead(id?:string){const {error}=await db().rpc("mark_notification_read",{p_notification_id:id??null});if(error)throw new Error("Impossible de marquer la notification comme lue.");}
