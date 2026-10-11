import type { Card } from "@/lib/data/cards";

export function CardFranchise({
  card,
  className = "mt-1 block truncate text-center text-[11px] text-ink-3"
}: {
  card: Pick<Card, "anime" | "category">;
  className?: string;
}) {
  return <span className={className}>{card.anime ?? card.category}</span>;
}
