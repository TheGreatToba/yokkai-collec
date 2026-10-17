import { CommunityPage } from "@/components/community-page";
import { redirect } from "next/navigation";
import { LocalProBadgePreview } from "@/components/local-pro-badge-preview";
import { localPremiumEnabled } from "@/lib/premium/plan";
import "@/styles/profile-style.css";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  if ((await searchParams).edition === "1") redirect("/settings");
  const profile = <CommunityPage screen="profile" />;
  return localPremiumEnabled() ? (
    <LocalProBadgePreview>{profile}</LocalProBadgePreview>
  ) : (
    profile
  );
}
