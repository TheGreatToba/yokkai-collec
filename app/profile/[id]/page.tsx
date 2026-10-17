import { CommunityPage } from "@/components/community-page";
import { LocalProfileStyleProvider } from "@/components/local-profile-style-context";
import { localPremiumEnabled } from "@/lib/premium/plan";
export default async function Page({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = (
    <CommunityPage screen="profile" playerId={decodeURIComponent(id)} />
  );
  return localPremiumEnabled() ? (
    <LocalProfileStyleProvider>{profile}</LocalProfileStyleProvider>
  ) : (
    profile
  );
}
