import { animation } from "@/lib/ui/animations";

export async function runPackOpeningOnce<T>(lock: { current: boolean }, task: () => Promise<T>) {
  if (lock.current) return;
  lock.current = true;
  try { return await task(); } finally { lock.current = false; }
}

const delay = (duration: number) => new Promise<void>(resolve => setTimeout(resolve, duration));

export async function runPackOpeningSequence<T>({ open, wait = delay, onResponse, onSeal }: {
  open: () => Promise<T>;
  wait?: (duration: number) => Promise<void>;
  onResponse: (result: T) => void;
  onSeal: () => void;
}) {
  const tension = wait(animation.packOpening.minimumTension);
  const result = await open();
  onResponse(result);
  await tension;
  onSeal();
  await wait(animation.packOpening.seal);
  return result;
}
