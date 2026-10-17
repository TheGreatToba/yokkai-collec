import { Game } from "@/components/game";
import { AccountMenu } from "@/components/account-menu";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LocalCardCustomizationBoundary } from "@/components/local-card-customization-boundary";

export default async function Collection() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <LocalCardCustomizationBoundary userId={user.id}>
      <Game key={user.id} view="collection" account={<AccountMenu />} />
    </LocalCardCustomizationBoundary>
  );
}
