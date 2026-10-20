"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPackStatus, type PackStatus } from "@/lib/data/cards";
import { browseAuctions, type AuctionData } from "@/lib/data/market";
import { subscribePlayerSnapshotInvalidation } from "@/lib/data/player-state";
import { packCountdown } from "@/lib/ui/pack-countdown";
import type { BigPull, HomeCard, HomePackStatus } from "@/lib/data/home";
import { StyledPlayerName } from "@/components/styled-player-name";
import { YokaiCard } from "@/components/yokai-card";
import { CatalogueCardModal } from "@/components/catalogue-card-modal";
import { Button, Karas } from "@/components/ui";

function useClock(interval = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

// Router snapshots can survive a trip to boosters. Refresh on return and on
// the same invalidation event that pack mutations already publish.
export function HomeRefresh() {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = 0;
    const refresh = () => {
      if (
        document.visibilityState === "hidden" ||
        Date.now() - lastRefresh < 1000
      )
        return;
      lastRefresh = Date.now();
      router.refresh();
    };
    refresh();
    const unsubscribe = subscribePlayerSnapshotInvalidation(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}

export function HomePackTimer({
  initial,
  preview = false
}: {
  initial: HomePackStatus;
  preview?: boolean;
}) {
  const [loadedStatus, setStatus] = useState<PackStatus | null>(null);
  const status = loadedStatus ?? initial;
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const now = useClock();
  useEffect(() => {
    let active = true;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const value = await getPackStatus();
        if (!active) return;
        setStatus(value);
        setError(false);
        if (deadline) clearTimeout(deadline);
        if (value.nextPackAt !== null)
          deadline = setTimeout(
            () => void load(),
            Math.max(1000, value.nextPackAt - Date.now() + 100)
          );
      } catch {
        if (active) setError(true);
      }
    };

    if (!preview) void load();
    const refresh = () => {
      if (!preview && document.visibilityState !== "hidden") void load();
    };
    const unsubscribe = preview
      ? () => {}
      : subscribePlayerSnapshotInvalidation(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      if (deadline) clearTimeout(deadline);
      unsubscribe();
      window.removeEventListener("focus", refresh);
    };
  }, [initial, preview, retry]);
  const full = status.nextPackAt === null && status.available >= status.maximum;
  return (
    <div className="yk-home-pack-content">
      <div>
        <p className="eyebrow">Your next discovery</p>
        <h3 aria-live="polite">
          {status.available > 0
            ? `${status.available} packs ready`
            : "Your next pack is on its way"}
        </h3>
        <p>
          {status.available} / {status.maximum} packs
          {full ? " · Full" : " in reserve"}
        </p>
        {!full && status.nextPackAt !== null && (
          <p className="yk-home-clock">
            Next pack in{" "}
            <span role="timer" aria-live="off">
              {now === null || !loadedStatus
                ? "—:—"
                : packCountdown(status.nextPackAt, now)}
            </span>
          </p>
        )}
        {error && (
          <p role="status">
            Couldn&apos;t refresh your packs.{" "}
            <Button
              variant="secondary"
              onClick={() => setRetry(value => value + 1)}
            >
              Try again
            </Button>
          </p>
        )}
      </div>
      <Link href="/boosters" className="yk-button yk-button-primary">
        {status.available > 0 ? "Open a booster" : "Visit packs"} ↗
      </Link>
    </div>
  );
}

export function LatestPulls({ cards }: { cards: HomeCard[] }) {
  const [selected, setSelected] = useState<HomeCard | null>(null);
  return (
    <>
      {cards.length ? (
        <div className="yk-home-card-grid">
          {cards.map(card => (
            <button
              type="button"
              className="yk-home-card-button"
              key={card.instanceId}
              aria-label={`View ${card.name}${card.shiny ? ", shiny" : ""}`}
              onClick={() => setSelected(card)}
            >
              <YokaiCard {...card} animated={false} />
            </button>
          ))}
        </div>
      ) : (
        <p className="yk-home-empty">
          No cards yet — <Link href="/boosters">open your first booster</Link>
        </p>
      )}
      <CatalogueCardModal
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

export function BigPulls({ pulls }: { pulls: BigPull[] }) {
  const now = useClock(60_000);
  const relative = (date: string) => {
    if (now === null) return "Recently";
    const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60_000));
    return minutes < 1
      ? "Just now"
      : minutes < 60
        ? `${minutes.toLocaleString("en-US")}m ago`
        : minutes < 1440
          ? `${Math.floor(minutes / 60).toLocaleString("en-US")}h ago`
          : `${Math.floor(minutes / 1440).toLocaleString("en-US")}d ago`;
  };
  return pulls.length ? (
    <div className="yk-home-big">
      <label className="yk-home-motion-control">
        <input type="checkbox" />
        Pause animation
      </label>
      <div
        className="yk-home-big-window"
        tabIndex={0}
        role="region"
        aria-label="Recent big pulls, scroll to explore"
      >
        <div className="yk-home-big-track">
          {[0, 1].map(copy => (
            <div
              className="yk-home-big-set"
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
              inert={copy === 1 ? true : undefined}
            >
              {pulls.map(pull => (
                <article className="yk-home-big-pull" key={pull.instanceId}>
                  <YokaiCard {...pull.card} animated={false} />
                  <div>
                    <span className="eyebrow">
                      {pull.card.shiny ? "Shiny" : pull.card.rarity} pull
                    </span>
                    <h3>{pull.card.name}</h3>
                    <Link href={`/profile/${pull.playerId}`}>
                      <StyledPlayerName
                        name={pull.playerName}
                        cosmetics={pull.profileStyle}
                      />
                    </Link>
                    <time dateTime={pull.obtainedAt}>
                      {relative(pull.obtainedAt)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : (
    <p className="yk-home-empty">The next big pull could be yours.</p>
  );
}

export function HomeMarket({
  initial,
  preview = false
}: {
  initial: AuctionData[];
  preview?: boolean;
}) {
  const [loaded, setAuctions] = useState<{
    source: AuctionData[];
    items: AuctionData[];
  } | null>(null);
  const auctions = loaded?.source === initial ? loaded.items : initial;
  const [error, setError] = useState(false);
  const now = useClock();

  useEffect(() => {
    if (preview) return;
    let active = true;
    const nextEnd = Math.min(...auctions.map(item => Date.parse(item.endsAt)));
    if (!Number.isFinite(nextEnd)) return;
    const timer = setTimeout(
      () => {
        void browseAuctions(
          {
            query: "",
            rarity: "",
            category: "",
            sort: "end",
            section: "active"
          },
          6
        ).then(
          page => {
            if (active) {
              setAuctions({ source: initial, items: page.items });
              setError(false);
            }
          },
          () => {
            if (active) setError(true);
          }
        );
      },
      Math.max(1000, nextEnd - Date.now() + 100)
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [auctions, initial, preview]);
  return (
    <>
      {error && (
        <p role="status">
          Couldn&apos;t refresh auctions.{" "}
          <Link href="/market">Browse the market</Link>
        </p>
      )}
      {auctions.length ? (
        <div className="yk-home-market-grid">
          {auctions.map(auction => (
            <Link
              href={`/market/${auction.id}`}
              className="yk-home-auction"
              key={auction.id}
            >
              <YokaiCard {...auction.card} animated={false} />
              <h3>{auction.card.name}</h3>
              <Karas amount={auction.amount} />
              <span role="timer" aria-live="off">
                {now === null
                  ? "Ending soon"
                  : Date.parse(auction.endsAt) <= now
                    ? "Ended"
                    : `${packCountdown(Date.parse(auction.endsAt), now)} left`}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="yk-home-empty">
          No active auctions yet. Check back for your next great find.
        </p>
      )}
    </>
  );
}
