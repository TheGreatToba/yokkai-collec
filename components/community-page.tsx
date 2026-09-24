import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentPseudo } from "@/lib/auth/session";
import { AccountMenu } from "@/components/account-menu";
import { CommunityView, type CommunityScreen } from "@/components/community-views";

export async function CommunityPage({screen,playerId}: {screen:CommunityScreen;playerId?:string}) {
  const user=await getCurrentUser();
  if(!user)redirect("/connexion");
  const isMe=!playerId||playerId===user.id;
  const name=isMe?await getCurrentPseudo(user.id):undefined;
  return <CommunityView key={`${screen}:${playerId ?? user.id}`} screen={screen} account={<AccountMenu/>} name={name??undefined} joined={isMe?user.created_at:undefined} isMe={isMe}/>;
}
