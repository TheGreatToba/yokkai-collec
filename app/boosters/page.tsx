import { AccountMenu } from "@/components/account-menu";
import { Game } from "@/components/game";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LocalBoosterComparison } from "@/components/local-booster-comparison";

export default async function BoostersPage({
  searchParams
}: {
  searchParams: Promise<{ live?: string }>;
}) {
  // Local visual test only. Production always retains authentication and Game.
  if (
    process.env.NODE_ENV === "development" &&
    (await searchParams).live !== "1"
  ) {
    return <LocalBoosterComparison />;
  }
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return <Game key={user.id} view="packs" account={<AccountMenu />} />;
}
