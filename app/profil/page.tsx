import { CommunityPage } from "@/components/community-page";
import { redirect } from "next/navigation";

export default async function Page({searchParams}:{searchParams:Promise<{edition?:string}>}) {
  if ((await searchParams).edition === "1") redirect("/parametres");
  return <CommunityPage screen="profile"/>;
}
