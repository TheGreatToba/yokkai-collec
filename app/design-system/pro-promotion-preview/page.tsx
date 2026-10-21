"use client";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { ProPromotionBanner } from "@/components/pro-promotion";
import { HomeHero } from "@/components/home-content";

export default function ProPromotionPreview() {
  const [visible, setVisible] = useState(true);
  const [view, setView] = useState<"home" | "packs" | "collection">("home");
  return (
    <>
      <Topbar view={view} name="Collector" karas={1240} notifications={[]} />
      {view === "home" && <ProPromotionBanner />}
      {view === "packs" && visible && (
        <ProPromotionBanner onDismiss={() => setVisible(false)} />
      )}
      <main id="main-content" className="yk-home-main">
        <div
          className="flex flex-wrap gap-3 mb-6"
          aria-label="Promotion preview pages"
        >
          <button
            type="button"
            className="yk-button"
            onClick={() => setView("home")}
          >
            Home preview
          </button>
          <button
            type="button"
            className="yk-button"
            onClick={() => setView("packs")}
          >
            Boosters preview
          </button>
          <button
            type="button"
            className="yk-button"
            onClick={() => setView("collection")}
          >
            Other page preview
          </button>
        </div>
        <HomeHero />
        {view === "packs" && !visible && (
          <button
            type="button"
            className="yk-button"
            onClick={() => setVisible(true)}
          >
            Show Pro banner
          </button>
        )}
      </main>
    </>
  );
}
