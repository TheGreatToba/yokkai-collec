"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPackStatus,
  getDecisionPackStatus,
  type PackStatus
} from "@/lib/data/cards";
import { browseAuctions, type AuctionData } from "@/lib/data/market";
import { subscribePlayerSnapshotInvalidation } from "@/lib/data/player-state";
import { packCountdown, auctionCountdown } from "@/lib/ui/pack-countdown";
import {
  decisionPackSummary,
  type BigPull,
  type HomeCard,
  type HomePackStatus
} from "@/lib/data/home";
import { StyledPlayerName } from "@/components/styled-player-name";
import { YokaiCard } from "@/components/yokai-card";
import { CatalogueCardModal } from "@/components/catalogue-card-modal";
import { Avatar, Button, Karas } from "@/components/ui";

import { enableHorizontalWheel } from "@/lib/ui/horizontal-wheel";

function useHorizontalWheel(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (enabled && ref.current) return enableHorizontalWheel(ref.current);
  }, [enabled]);
  return ref;
}

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
  preview = false,
  kind = "regular"
}: {
  initial: HomePackStatus;
  kind?: "regular" | "decision";
  preview?: boolean;
}) {
  const [loadedStatus, setStatus] = useState<
    (PackStatus & { canResume?: boolean }) | null
  >(null);
  const status = loadedStatus ?? initial;
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const now = useClock();
  useEffect(() => {
    let active = true;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const value =
          kind === "decision"
            ? decisionPackSummary(await getDecisionPackStatus(false))
            : await getPackStatus();
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
  }, [initial, preview, retry, kind]);
  const full = status.nextPackAt === null && status.available >= status.maximum;
  return (
    <div className={`yk-home-pack-content yk-home-pack-${kind}`}>
      <Image
        src={
          kind === "decision"
            ? "/assets/chrome-decision-booster-v1.png"
            : "/assets/chrome-regular-booster-v1.png"
        }
        alt=""
        width={68}
        height={116}
        className="yk-home-pack-art"
      />
      <div>
        <h3>{kind === "decision" ? "Decision Pack" : "Regular Pack"}</h3>
        <p className="yk-home-pack-state" aria-live="polite">
          {status.canResume
            ? "Finish your pack"
            : status.available > 0
              ? `${status.available} ${status.available === 1 ? "pack" : "packs"} ready`
              : "Available in"}
        </p>
        <p>
          {status.available} / {status.maximum} packs
          {full ? " · Full" : kind === "decision" ? " today" : " in reserve"}
        </p>
        {!full && status.nextPackAt !== null && (
          <p className="yk-home-clock">
            {kind === "decision" ? "Daily reset " : "Next pack "}
            <span role="timer" aria-live="off">
              {now === null || (!loadedStatus && !preview)
                ? "—:—"
                : packCountdown(status.nextPackAt, now, kind === "decision")}
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
    </div>
  );
}

export function LatestPulls({ cards }: { cards: HomeCard[] }) {
  const scrollRef = useHorizontalWheel(cards.length > 0);
  const [selected, setSelected] = useState<HomeCard | null>(null);
  return (
    <>
      {cards.length ? (
        <div className="yk-home-card-grid" ref={scrollRef}>
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
  const scrollRef = useHorizontalWheel(pulls.length > 0);
  return pulls.length ? (
    <div
      className="yk-home-big-window"
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label="Recent big pulls, scroll to explore"
    >
      <div className="yk-home-big-track">
        {pulls.map(pull => (
          <article className="yk-home-big-pull" key={pull.instanceId}>
            <YokaiCard {...pull.card} animated={false} />
            {pull.playerId && pull.playerName ? (
              <Link
                className="yk-home-pull-player"
                href={`/profile/${pull.playerId}`}
              >
                <Avatar
                  name={pull.playerName}
                  image={pull.avatarUrl ?? undefined}
                  size={22}
                />
                <span className="yk-home-pull-name">
                  <StyledPlayerName
                    name={pull.playerName}
                    cosmetics={pull.profileStyle ?? undefined}
                  />
                </span>
              </Link>
            ) : (
              <span className="yk-home-pull-player">
                <span className="yk-home-private-avatar" aria-hidden="true">
                  ?
                </span>
                <span>Private player</span>
              </span>
            )}
          </article>
        ))}
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
              <div className="yk-home-auction-meta">
                <Karas amount={auction.amount} />
                <span role="timer" aria-live="off" aria-label="Time remaining">
                  {now === null
                    ? "Ending soon"
                    : Date.parse(auction.endsAt) <= now
                      ? "Ended"
                      : auctionCountdown(Date.parse(auction.endsAt), now)}
                </span>
              </div>
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
