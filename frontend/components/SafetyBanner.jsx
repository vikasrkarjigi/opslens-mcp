"use client";

import { ShieldCheck, ShieldAlert, ShieldX, Activity } from "lucide-react";
import clsx from "clsx";

/**
 * status: "idle" | "active" | "blocked". Live gateway activity.
 * verdict: SafetyVerdict from the report (or null while running).
 */
export default function SafetyBanner({ status, blocked, totalCalls, verdict }) {
  // The verdict, once produced, takes precedence over live status because it
  // is the considered judgement of the Safety Critic.
  const verdictStatus = verdict?.status;
  let tone = "ok";
  let Icon = ShieldCheck;
  let label = "Safety Gateway: idle";
  let sub =
    "Deterministic policy layer. Every tool call is allow-listed and audited. Cannot be overridden by an LLM.";

  if (verdictStatus === "DO_NOT_RESTART") {
    tone = "danger";
    Icon = ShieldX;
    label = "Safety Verdict: DO NOT RESTART";
    sub =
      verdict.blocking_concerns?.[0] ||
      "Restart prohibited. Engineer + electrician sign-off required.";
  } else if (verdictStatus === "CAUTION_REQUIRED") {
    tone = "warn";
    Icon = ShieldAlert;
    label = "Safety Verdict: CAUTION REQUIRED";
    sub = "Proceed only after the human review checklist below is signed off.";
  } else if (verdictStatus === "CLEAR_TO_PROCEED") {
    tone = "ok";
    Icon = ShieldCheck;
    label = "Safety Verdict: CLEAR TO PROCEED";
    sub = "All checks satisfied. Engineer remains the final decision-maker.";
  } else if (status === "active") {
    tone = "warn";
    Icon = Activity;
    label = "Safety Gateway: ACTIVE, auditing every tool call";
  } else if (status === "blocked") {
    tone = "danger";
    Icon = ShieldX;
    label = "Safety Gateway: BLOCKED a tool call";
  }

  const palette = {
    ok: {
      wrap: "bg-gradient-to-r from-emerald-50 via-emerald-50/70 to-white border-emerald-200",
      icon: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/40",
      title: "text-emerald-900",
      sub: "text-emerald-800/80",
      meta: "text-emerald-800/70",
    },
    warn: {
      wrap: "bg-gradient-to-r from-amber-50 via-amber-50/70 to-white border-amber-200",
      icon: "bg-amber-500 text-white shadow-sm shadow-amber-500/40",
      title: "text-amber-900",
      sub: "text-amber-800/80",
      meta: "text-amber-800/70",
    },
    danger: {
      wrap: "bg-gradient-to-r from-rose-50 via-rose-50/70 to-white border-rose-300",
      icon: "bg-rose-500 text-white shadow-sm shadow-rose-500/50",
      title: "text-rose-900",
      sub: "text-rose-800/85",
      meta: "text-rose-800/70",
    },
  }[tone];

  // One-shot red flash when the hard veto fires. `key` forces remount so the
  // animation replays each time the verdict transitions to DO_NOT_RESTART.
  const flash = verdictStatus === "DO_NOT_RESTART";

  return (
    <div
      key={flash ? "do-not-restart" : tone}
      className={clsx(
        "relative flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-card",
        palette.wrap,
        flash && "animate-flashRed"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={clsx("rounded-xl p-2.5 flex-none", palette.icon)}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <div className={clsx("text-base font-bold tracking-tight", palette.title)}>
            {label}
          </div>
          <div className={clsx("text-xs leading-relaxed mt-0.5", palette.sub)}>{sub}</div>
          {verdict?.cited_sops?.length > 0 && (
            <div className={clsx("mt-1.5 text-[11px]", palette.meta)}>
              Cited SOPs:{" "}
              <span className="font-mono font-medium">{verdict.cited_sops.join(", ")}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-5 text-xs flex-none">
        <div className="text-right">
          <div className={clsx("uppercase tracking-wider text-[10px] font-semibold", palette.meta)}>
            Calls audited
          </div>
          <div className={clsx("text-2xl font-bold tabular-nums leading-none mt-1", palette.title)}>
            {totalCalls}
          </div>
        </div>
        <div className="h-10 w-px bg-current/20" />
        <div className="text-right">
          <div className={clsx("uppercase tracking-wider text-[10px] font-semibold", palette.meta)}>
            Calls blocked
          </div>
          <div
            className={clsx(
              "text-2xl font-bold tabular-nums leading-none mt-1",
              blocked > 0 ? "text-rose-700" : palette.title
            )}
          >
            {blocked}
          </div>
        </div>
      </div>
    </div>
  );
}
