import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser, getCurrentPseudo } from "@/lib/auth/session";
import { AccountMenu } from "@/components/account-menu";
import { LocalCardCustomizationBoundary } from "@/components/local-card-customization-boundary";
import {
  CommunityView,
  type CommunityScreen
} from "@/components/community-views";

export async function CommunityPage({
  screen,
  playerId,
  auctionId,
  pageHeading
}: {
  pageHeading?: ReactNode;
  screen: CommunityScreen;
  playerId?: string;
  auctionId?: string;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isMe = !playerId || playerId === user.id;
  const name = isMe ? await getCurrentPseudo(user.id) : undefined;
  const content = (
    <CommunityView
      key={`${screen}:${playerId ?? auctionId ?? user.id}`}
      screen={screen}
      pageHeading={pageHeading}
      account={<AccountMenu />}
      name={name ?? undefined}
      joined={isMe ? user.created_at : undefined}
      isMe={isMe}
      playerId={playerId}
      auctionId={auctionId}
    />
  );
  return screen === "profile" ? (
    <LocalCardCustomizationBoundary userId={user.id}>
      {content}
    </LocalCardCustomizationBoundary>
  ) : (
    content
  );
}
