"use client";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { ProPromotionBanner } from "@/components/pro-promotion";
import { HomeHero } from "@/components/home-content";

export default function ProPromotionPreview() {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <Topbar view="home" name="Collector" karas={1240} notifications={[]} />
      {visible && <ProPromotionBanner onDismiss={() => setVisible(false)} />}
      <main id="main-content" className="yk-home-main">
        <HomeHero />
        {!visible && (
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
