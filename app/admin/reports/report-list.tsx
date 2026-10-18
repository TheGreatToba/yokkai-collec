"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setReportStatusAction, type ReportActionState } from "./actions";

export type AdminReport = {
  id: string;
  reporterId: string;
  reporterPseudo: string;
  reporterEmail: string;
  reportedId: string;
  reportedPseudo: string;
  reportedEmail: string;
  reportedIsBanned: boolean;
  reason: "harassment" | "inappropriate" | "spam" | "cheating" | "other";
  contextType: "profile" | "auction_chat";
  contextId: string | null;
  snapshot: { message?: string; gifUrl?: string | null };
  details: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
};

const reasons: Record<AdminReport["reason"], string> = {
  harassment: "Harcèlement",
  inappropriate: "Contenu inapproprié",
  spam: "Spam",
  cheating: "Triche",
  other: "Autre"
};
const statuses: Record<
  AdminReport["status"],
  { label: string; style: string }
> = {
  pending: {
    label: "En attente",
    style: "border-amber-300/30 bg-amber-400/10 text-amber-200"
  },
  reviewed: {
    label: "Traité",
    style: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
  },
  dismissed: {
    label: "Ignoré",
    style: "border-slate-400/30 bg-slate-400/10 text-slate-300"
  }
};
const initialState: ReportActionState = { ok: false, message: "" };

function ReportActions({ report }: { report: AdminReport }) {
  const [state, action, pending] = useActionState(
    setReportStatusAction,
    initialState
  );
  return (
    <div>
      <form action={action} className="flex flex-wrap gap-2">
        <input name="report_id" type="hidden" value={report.id} />
        {report.status !== "reviewed" && (
          <button
            className="yk-button"
            disabled={pending}
            name="status"
            type="submit"
            value="reviewed"
          >
            Marquer comme traité
          </button>
        )}
        {report.status !== "dismissed" && (
          <button
            className="yk-button yk-button-secondary"
            disabled={pending}
            name="status"
            type="submit"
            value="dismissed"
          >
            Ignorer
          </button>
        )}
        {report.status !== "pending" && (
          <button
            className="yk-button yk-button-secondary"
            disabled={pending}
            name="status"
            type="submit"
            value="pending"
          >
            Remettre en attente
          </button>
        )}
      </form>
      {state.message && (
        <p
          className={`mt-2 text-xs ${state.ok ? "text-emerald-300" : "text-red-300"}`}
          role="status"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

function reportDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris"
  }).format(new Date(value));
}

export function ReportList({
  reports,
  playerHrefBase
}: {
  reports: AdminReport[];
  playerHrefBase: string;
}) {
  if (!reports.length)
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-10 text-center text-slate-400">
        Aucun signalement trouvé.
      </section>
    );
  return (
    <section className="space-y-4">
      {reports.map(report => {
        const status = statuses[report.status];
        return (
          <article
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
            key={report.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status.style}`}
                  >
                    {status.label}
                  </span>
                  <span className="rounded-full border border-red-300/20 bg-red-400/10 px-2.5 py-1 text-xs font-bold text-red-200">
                    {reasons[report.reason]}
                  </span>
                  {report.reportedIsBanned && (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-300">
                      Joueur banni
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Reçu le {reportDate(report.createdAt)}
                </p>
              </div>
              <span className="text-xs text-slate-600">
                #{report.id.slice(0, 8)}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Signalé par
                </p>
                <p className="mt-2 font-bold">{report.reporterPseudo}</p>
                <p className="text-sm text-slate-400">{report.reporterEmail}</p>
                {report.reporterId && (
                  <Link
                    className="mt-3 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                    href={`${playerHrefBase}${report.reporterId}`}
                  >
                    Voir ce joueur →
                  </Link>
                )}
              </div>
              <div className="rounded-xl border border-red-300/15 bg-red-950/20 p-4">
                <p className="text-xs uppercase tracking-widest text-red-300/70">
                  Joueur signalé
                </p>
                <p className="mt-2 font-bold">{report.reportedPseudo}</p>
                <p className="text-sm text-slate-400">{report.reportedEmail}</p>
                {report.reportedId && (
                  <Link
                    className="mt-3 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                    href={`${playerHrefBase}${report.reportedId}`}
                  >
                    Ouvrir sa fiche admin →
                  </Link>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Contexte
              </p>
              <p className="mt-2 text-sm font-semibold">
                {report.contextType === "auction_chat"
                  ? "Message dans le chat d’une enchère"
                  : "Profil du joueur"}
              </p>
              {report.snapshot.message && (
                <blockquote className="mt-3 border-l-2 border-cyan-400 pl-3 text-sm text-slate-300">
                  {report.snapshot.message}
                </blockquote>
              )}
              {report.snapshot.gifUrl && (
                <a
                  className="mt-3 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                  href={report.snapshot.gifUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Voir le GIF signalé ↗
                </a>
              )}
              {report.details && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Détails du signalement
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                    {report.details}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <ReportActions report={report} />
            </div>
          </article>
        );
      })}
    </section>
  );
}
