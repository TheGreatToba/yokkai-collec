import type { Metadata } from "next";
import { PrivateMessagesPreview } from "@/components/private-messages-preview";
import { Topbar } from "@/components/topbar";

export const metadata: Metadata = {
  title: "Private messages preview · Yokkai Collec'",
  robots: { index: false, follow: false }
};
export default function Page() {
  return (
    <>
      <Topbar view="friends" name="BBDOU" karas={4499} notifications={[]} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="eyebrow">Between collectors</p>
        <h1 className="yk-title mt-3">My friends</h1>
        <div className="mt-8">
          <PrivateMessagesPreview />
        </div>
      </main>
    </>
  );
}
