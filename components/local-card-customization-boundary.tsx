import type { ReactNode } from "react";
import { getLocalCardCustomizationAccess } from "@/lib/premium/card-customization";
import { CardCustomizationAccessProvider } from "@/components/card-customization-access";

export async function LocalCardCustomizationBoundary({
  userId,
  children
}: {
  userId: string;
  children: ReactNode;
}) {
  const allowed = await getLocalCardCustomizationAccess(userId);
  if (allowed === null) return children;
  return (
    <CardCustomizationAccessProvider allowed={allowed}>
      {children}
    </CardCustomizationAccessProvider>
  );
}
