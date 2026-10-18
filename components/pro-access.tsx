"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_PROFILE_STYLE,
  normalizeProfileStyle,
  type ProfileStyle
} from "@/lib/ui/profile-style";

const ProAccess = createContext(false);
const OwnStyle = createContext<ProfileStyle | null>(null);
export const useProAccess = () => useContext(ProAccess);
export const useOwnProfileStyle = () => useContext(OwnStyle);

// Presentation only. Every mutation independently checks paid membership on the server.
// No local storage, URL flags, or browser billing events can grant access.
export function ProAccessProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [style, setStyle] = useState<ProfileStyle | null>(null);
  useEffect(() => {
    let stopped = false;
    let request: AbortController | null = null;
    async function sync() {
      if (request || stopped || document.visibilityState !== "visible") return;
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch("/api/pro/benefits", {
          cache: "no-store",
          signal: controller.signal
        });
        const result = response.ok ? await response.json() : null;
        let ownStyle = null;
        if (result?.active === true) {
          const styleResponse = await fetch("/api/pro/profile-style", {
            cache: "no-store",
            signal: controller.signal
          });
          const projection = styleResponse.ok
            ? await styleResponse.json()
            : null;
          if (projection?.active === true)
            ownStyle = normalizeProfileStyle({
              ...DEFAULT_PROFILE_STYLE,
              ...projection.style
            });
        }
        if (
          !stopped &&
          !controller.signal.aborted &&
          document.visibilityState === "visible"
        ) {
          setActive(result?.active === true && ownStyle !== null);
          setStyle(ownStyle);
        }
      } catch {
        if (!stopped) {
          setActive(false);
          setStyle(null);
        }
      } finally {
        window.clearTimeout(timeout);
        request = null;
      }
    }
    const resume = () => {
      void sync();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    window.addEventListener("yokkai:profile-style-updated", resume);
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(resume, 30000);
    resume();
    return () => {
      stopped = true;
      request?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("yokkai:profile-style-updated", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return (
    <ProAccess.Provider value={active}>
      <OwnStyle.Provider value={active ? style : null}>
        {active && style?.backgroundUrl && (
          <div
            aria-hidden="true"
            className="yk-pro-site-background"
            style={{
              backgroundImage: `url(${JSON.stringify(style.backgroundUrl)})`
            }}
          />
        )}
        {children}
      </OwnStyle.Provider>
    </ProAccess.Provider>
  );
}

export function ProFeatureNotice({ feature }: { feature: string }) {
  return (
    <p className="mt-2 text-xs text-ink-2">
      {feature} is available to Pro members only.{" "}
      <Link href="/premium" className="underline">
        Discover Yokkai Pro
      </Link>
    </p>
  );
}
