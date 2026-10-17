import {
  normalizeLocalProfileStyle,
  type LocalProfileStyle
} from "@/lib/ui/local-profile-style";

// One browser tab only. No storage, server entitlement, or profile write.
export function createLocalPlayerStyleStore(enabled: boolean) {
  const styles = new Map<string, LocalProfileStyle>();
  const listeners = new Set<() => void>();
  return {
    get(userId?: string) {
      return enabled && userId ? (styles.get(userId) ?? null) : null;
    },
    publish(userId: string, input: LocalProfileStyle) {
      if (!enabled || !userId) return;
      const style = normalizeLocalProfileStyle(input);
      Object.freeze(style.badges);
      styles.set(userId, Object.freeze(style));
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export const localPlayerStyles = createLocalPlayerStyleStore(
  process.env.NODE_ENV === "development"
);
