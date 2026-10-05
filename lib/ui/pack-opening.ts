export async function runPackOpeningOnce(lock: { current: boolean }, task: () => Promise<void>) {
  if (lock.current) return;
  lock.current = true;
  try { await task(); } finally { lock.current = false; }
}
