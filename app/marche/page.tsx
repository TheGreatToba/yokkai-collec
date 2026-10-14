import { CommunityPage } from "@/components/community-page";
export default function Page() {
  return (
    <CommunityPage
      screen="market"
      pageHeading={
        <div>
          <p className="eyebrow">La salle des ventes</p>
          <h1 className="yk-title mt-3">Marché</h1>
        </div>
      }
    />
  );
}
