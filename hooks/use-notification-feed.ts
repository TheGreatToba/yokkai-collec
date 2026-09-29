"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getNotifications, NotificationRequestError, type AppNotification } from "@/lib/data/notifications";

const POLL_INTERVAL_MS = 10000;

// Polls list_notifications and refreshes on demand (panel opening) and when the tab becomes visible again.
// A refresh requested while another one is in flight is dropped, so triggers never stack requests.
export function useNotificationFeed(enabled = true, load: () => Promise<AppNotification[]> = getNotifications) {
  const [notifications, setNotifications] = useState<AppNotification[]>();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(() => {
    if (!enabled || inFlight.current) return Promise.resolve();
    inFlight.current = true;
    return load().then(items => {
      if (mounted.current) { setNotifications(items); setError(""); }
    }, failure => {
      if (process.env.NODE_ENV !== "production") console.error("[notifications] list_notifications failed", { message: failure instanceof Error ? failure.message : String(failure), code: failure instanceof NotificationRequestError ? failure.code : undefined, error: failure });
      if (mounted.current) setError("Impossible de charger tes notifications.");
    }).finally(() => { inFlight.current = false; });
  }, [enabled, load]);
  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { mounted.current = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [enabled, refresh]);
  const retry = useCallback(() => { setError(""); void refresh(); }, [refresh]);
  return { notifications, setNotifications, error, refresh, retry };
}
