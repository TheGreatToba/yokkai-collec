"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button, Modal } from "@/components/ui";
import { createClient } from "@/utils/supabase/client";
import "@/styles/referral-reminder.css";

type CopyState = "idle" | "copied" | "error";

function dismissalKey(userId: string) {
  return `yokkai-referral-reminder-dismissed:${userId}`;
}

function fallbackCopy(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("COPY_FAILED");
}

export function ReferralReminder({
  packChoices = false
}: {
  packChoices?: boolean;
}) {
  const [choicesOpen, setChoicesOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "/design-system/home-preview";
  const isBoosters = pathname === "/boosters";
  const [visible, setVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (isHome || (isBoosters && !packChoices)) return;
    let active = true;
    const supabase = createClient();

    async function prepareLink() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      if (!isBoosters && localStorage.getItem(dismissalKey(user.id)) === "1") {
        setVisible(false);
        return;
      }

      setUserId(user.id);
      setVisible(true);

      const { data: status } = await supabase.rpc("get_referral_status");
      if (!active) return;
      const existingCode =
        status &&
        typeof status === "object" &&
        "code" in status &&
        typeof status.code === "string"
          ? status.code
          : null;
      if (existingCode) {
        setCode(existingCode);
        return;
      }

      const { data: createdCode } = await supabase.rpc("create_referral_code");
      if (active && typeof createdCode === "string") setCode(createdCode);
    }

    void prepareLink();
    return () => {
      active = false;
    };
  }, [isHome, isBoosters, packChoices]);

  function dismiss() {
    if (userId) localStorage.setItem(dismissalKey(userId), "1");
    setVisible(false);
  }

  async function copyLink() {
    if (!code) return;
    const link = `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        fallbackCopy(link);
      }
      setCopyState("copied");
    } catch {
      try {
        fallbackCopy(link);
        setCopyState("copied");
      } catch {
        setCopyState("error");
      }
    }
  }

  if (!visible || isHome || (isBoosters && !packChoices)) return null;

  const content = (
    <>
      <aside
        style={choicesOpen ? { display: "none" } : undefined}
        aria-label="Referral reward"
        className={
          isBoosters
            ? "yk-referral-reminder--boosters"
            : [
                "fixed bottom-4 left-16 z-[70] grid w-[min(calc(100vw-5rem),32rem)]",
                "grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[18px]",
                "border border-veil-strong bg-surface/95 px-4 py-2.5 backdrop-blur-md",
                "shadow-[0_14px_45px_rgba(0,0,0,0.55),0_0_24px_rgba(141,173,255,0.08)]",
                "max-sm:left-3 max-sm:w-[calc(100vw-1.5rem)]"
              ].join(" ")
        }
      >
        <div className="min-w-0">
          <p className="yk-referral-reminder-title truncate font-display text-sm font-bold tracking-wide text-ink">
            {isBoosters
              ? "Want more boosters?"
              : "Invite friends · Earn 5 bonus packs"}
          </p>
          <p className="yk-referral-reminder-note mt-0.5 truncate text-[11px] text-ink-3">
            {isBoosters
              ? "Invite friends or explore Pro."
              : "Rewarded after their email is verified."}
          </p>
        </div>
        <Button
          type="button"
          disabled={!packChoices && !code}
          onClick={() => (packChoices ? setChoicesOpen(true) : void copyLink())}
          className="yk-referral-reminder-copy min-h-9 whitespace-nowrap !rounded-full px-5 py-2 text-xs"
        >
          {packChoices
            ? "Explore"
            : !code
              ? "Preparing…"
              : copyState === "copied"
                ? "Copied"
                : "Copy link"}
        </Button>
        {!isBoosters && (
          <button
            type="button"
            aria-label="Dismiss referral reminder"
            onClick={dismiss}
            className="grid h-7 w-7 place-items-center rounded-full border border-veil text-base leading-none text-ink-3 transition hover:border-focus hover:bg-veil hover:text-ink"
          >
            ×
          </button>
        )}
        {copyState === "error" && (
          <p role="alert" className="col-span-3 text-[11px] text-danger">
            Couldn&apos;t copy the link. Try again from Settings.
          </p>
        )}
      </aside>
      <Modal
        open={choicesOpen}
        onClose={() => setChoicesOpen(false)}
        title="Want more boosters?"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-panel border border-veil p-5">
            <h3 className="font-display text-xl">Invite friends</h3>
            <p className="my-4 text-sm text-ink-2">
              Earn 5 bonus packs when your friend verifies their email.
            </p>
            <Button disabled={!code} onClick={() => void copyLink()}>
              {!code
                ? "Preparing…"
                : copyState === "copied"
                  ? "Copied"
                  : "Copy link"}
            </Button>
            {copyState === "error" && (
              <p role="alert" className="mt-3 text-sm text-danger">
                Couldn&apos;t copy the link. Please try again.
              </p>
            )}
          </section>
          <section className="rounded-panel border border-veil p-5">
            <h3 className="font-display text-xl">Get Pro</h3>
            <p className="my-4 text-sm text-ink-2">
              Refill your packs faster with Yokkai Pro.
            </p>
            <Link href="/premium" className="yk-button yk-button-primary">
              Explore Pro
            </Link>
          </section>
        </div>
      </Modal>
    </>
  );
  return packChoices ? createPortal(content, document.body) : content;
}
