import { animation } from "@/lib/ui/animations";

export async function runPackOpeningOnce<T>(
  lock: { current: boolean },
  task: () => Promise<T>
) {
  if (lock.current) return;
  lock.current = true;
  try {
    return await task();
  } finally {
    lock.current = false;
  }
}

const delay = (duration: number) =>
  new Promise<void>(resolve => setTimeout(resolve, duration));

export async function runPackOpeningSequence<T>({
  open,
  wait = delay,
  onResponse,
  onSeal
}: {
  open: () => Promise<T>;
  wait?: (duration: number) => Promise<void>;
  onResponse: (result: T) => void;
  onSeal: () => void | Promise<void>;
}) {
  const tension = wait(animation.packOpening.minimumTension);
  const result = await open();
  onResponse(result);
  await tension;
  await onSeal();
  await wait(animation.packOpening.seal);
  return result;
}

// Wait for the existing server result and the decorative opening independently.
// Skipping visuals must never submit a second pack request.
export async function runFinalBoosterOpening<T>({
  open,
  finished,
  onResponse,
  preload
}: {
  open: () => Promise<T[] | undefined>;
  finished: Promise<void>;
  onResponse: (cards: T[] | undefined) => void;
  preload: () => Promise<void>;
}) {
  const cards = await open();
  onResponse(cards);
  if (!cards?.length) return false;
  await Promise.all([finished, preload()]);
  return true;
}

export function packCopySnapshot<T extends { id: string }>(
  collection: T[],
  complete: boolean
): Record<string, number> | null {
  return complete
    ? collection.reduce<Record<string, number>>((counts, card) => {
        counts[card.id] = (counts[card.id] || 0) + 1;
        return counts;
      }, {})
    : null;
}
export function packCopyLabels<T extends { id: string }>(
  cards: T[],
  snapshot: Record<string, number> | null
): (T & { isNew?: boolean; copies?: number })[] {
  const counts = { ...snapshot };
  return cards.map(card => {
    if (snapshot === null)
      return { ...card, isNew: undefined, copies: undefined };
    const previous = counts[card.id] || 0;
    counts[card.id] = previous + 1;
    return { ...card, isNew: previous === 0, copies: previous + 1 };
  });
}
