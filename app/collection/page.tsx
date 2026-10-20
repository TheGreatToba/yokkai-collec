import { Game } from "@/components/game";
import { AccountMenu } from "@/components/account-menu";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getDiscordInviteUrl } from "@/lib/discord-invite";

export default async function Collection() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Game
      key={user.id}
      view="collection"
      account={<AccountMenu />}
      discordEnabled={Boolean(getDiscordInviteUrl())}
    />
  );
}
