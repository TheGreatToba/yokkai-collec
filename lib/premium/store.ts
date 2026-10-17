import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PremiumStyle } from "./plan";

export type BillingUser = {
  customerId: string;
  checkoutId?: string;
  style?: PremiumStyle;
};
export type BillingData = {
  users: Record<string, BillingUser>;
  events: string[];
};

// Local, single-machine prototype only. A cross-process lock and atomic rename
// prevent duplicate checkout creation and lost updates across Next.js bundles.
export async function billingTransaction<T>(
  directory: string,
  operation: (data: BillingData) => Promise<T>
): Promise<T> {
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, "state.lock");
  const deadline = Date.now() + 30_000;
  let lock;
  while (!lock) {
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        Date.now() >= deadline
      )
        throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  let temp: string | undefined;
  try {
    let data: BillingData;
    try {
      data = JSON.parse(await readFile(join(directory, "state.json"), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      data = { users: {}, events: [] };
    }
    const result = await operation(data);
    temp = join(directory, `${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
    await rename(temp, join(directory, "state.json"));
    temp = undefined;
    return result;
  } finally {
    if (temp) await unlink(temp).catch(() => {});
    await lock.close();
    await unlink(lockPath);
  }
}
