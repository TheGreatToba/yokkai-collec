import { notFound } from "next/navigation";
import { AuthMarketCapturePreview } from "@/components/auth-market-capture-preview";
import { Topbar } from "@/components/topbar";

export const metadata = {
  title: "Market showcase capture",
  robots: { index: false, follow: false }
};

export default async function AuthMarketCapture({
  searchParams
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { mode } = await searchParams;
  return (
    <>
      <Topbar view="market" name="Nova" karas={6132} notifications={[]} />
      <main data-market-capture className="mx-auto w-full max-w-7xl px-6 py-10">
        <AuthMarketCapturePreview
          mode={mode === "auction" ? "auction" : "market"}
        />
      </main>
    </>
  );
}
