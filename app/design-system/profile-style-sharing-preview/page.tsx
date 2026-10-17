import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getCurrentPseudo } from "@/lib/auth/session";
import { localPremiumEnabled } from "@/lib/premium/plan";
import { ProfileStyleSharingPreview } from "@/components/profile-style-sharing-preview";

export default async function Page() {
  if (!localPremiumEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = (await getCurrentPseudo(user.id)) ?? "Collector";
  return <ProfileStyleSharingPreview userId={user.id} name={name} />;
}
