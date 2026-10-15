import { CommunityPage } from "@/components/community-page";
export default function Page() {
  return (
    <CommunityPage
      screen="market"
      pageHeading={
        <div>
          <p className="eyebrow">The auction house</p>
          <h1 className="yk-title mt-3">Market</h1>
        </div>
      }
    />
  );
}
