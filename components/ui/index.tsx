"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button type={type} className={`yk-button yk-button-${variant} ${className}`} {...props} />;
}
export function Chip({ active = false, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button type="button" aria-pressed={active} className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-accent-gold bg-veil text-ink" : "border-veil bg-night text-ink-2 hover:border-veil-strong"} ${className}`} {...props} />;
}
export function StatusPill({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "success" | "danger" | "info" }) {
  const tones = { gold: "bg-accent-gold/14 text-karas", success: "bg-success/14 text-success", danger: "bg-danger/14 text-danger-ink", info: "bg-accent-neon/14 text-accent-neon" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
export function Karas({ amount, className = "" }: { amount?: number | null; className?: string }) {
  return <span className={`inline-flex items-center gap-2 text-karas tabular-nums ${className}`} aria-label={amount == null ? "Solde karas indisponible" : `${amount.toLocaleString("fr-FR")} karas`}><span aria-hidden="true" className="yk-karas-gem" />{amount == null ? "—" : amount.toLocaleString("fr-FR")}</span>;
}
export function Avatar({ name, image, online, size = 40 }: { name: string; image?: string; online?: boolean; size?: number }) {
  return <span className="relative inline-flex shrink-0 items-center justify-center rounded-full border border-accent-gold/40 bg-veil font-display font-semibold text-accent-gold" style={{ width: size, height: size }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {image ? <img src={image} alt={name} width={size} height={size} className="size-full rounded-full object-cover" /> : <span aria-label={name}>{name.slice(0, 1).toLocaleUpperCase("fr-FR") || "?"}</span>}
    {online !== undefined && <span aria-label={online ? "En ligne" : "Hors ligne"} className={`absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-night ${online ? "bg-success" : "bg-ink-3"}`} />}
  </span>;
}
let modalLockCount = 0;
let bodyOverflowBeforeModal = "";

function lockModalScroll() {
  if (modalLockCount === 0) bodyOverflowBeforeModal = document.body.style.overflow;
  modalLockCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockModalScroll() {
  modalLockCount = Math.max(0, modalLockCount - 1);
  if (modalLockCount === 0) document.body.style.overflow = bodyOverflowBeforeModal;
}

export function Modal({ open, onClose, title, children, className = "" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    lockModalScroll();
    return () => {
      if (dialog.open) dialog.close();
      unlockModalScroll();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} className={`yk-modal ${className}`} onCancel={e => { e.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  }}><div className="mb-6 flex items-center justify-between gap-4"><h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2><button type="button" autoFocus onClick={onClose} aria-label="Fermer" className="size-9 shrink-0 rounded-full border border-veil text-ink-2 hover:bg-veil">✕</button></div>{open && children}</dialog>;
}
export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { if (!message) return; const timer = window.setTimeout(onDismiss, 2600); return () => clearTimeout(timer); }, [message, onDismiss]);
  return message ? <div role="status" className="fixed top-20 left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full border border-veil-strong bg-veil px-6 py-3 text-sm shadow-modal">{message}</div> : null;
}
