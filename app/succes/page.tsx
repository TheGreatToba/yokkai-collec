import { redirect } from "next/navigation";
import { AchievementsPage } from "@/components/achievements";
import { AccountMenu } from "@/components/account-menu";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Page() {
  if (!(await getCurrentUser())) redirect("/connexion");
  return <AchievementsPage account={<AccountMenu />} />;
}
