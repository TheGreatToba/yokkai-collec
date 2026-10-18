import { notFound, redirect } from "next/navigation";
import { billingSandboxEnabled } from "@/lib/billing/sandbox";

// Local Checkout return only. The production sales page is a separate delivery.
export default function Page() {
  if (!billingSandboxEnabled()) notFound();
  redirect("/design-system/billing-preview");
}
