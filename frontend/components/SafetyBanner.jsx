"use client";

import { ShieldCheck, ShieldAlert, ShieldX, Activity } from "lucide-react";
import clsx from "clsx";

/**
 * status: "idle" | "active" | "blocked" — live gateway activity.
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
    "Deterministic policy layer — every tool call is allow-listed and audited. Cannot be overridden by an LLM.";

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
    label = "Safety Gateway: ACTIVE — auditing every tool call";
  } else if (status === "blocked") {
    tone = "danger";
    Icon = ShieldX;
    label = "Safety Gateway: BLOCKED a tool call";
  }

  const styles = {
    ok: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    warn: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    danger: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  }[tone];

  return (
    <div className={clsx("flex items-center justify-between rounded-xl border px-4 py-3", styles)}>
      <div className="flex items-center gap-3">
        <div className="rounded-md p-2 bg-black/20">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs opacity-80">{sub}</div>
          {verdict?.cited_sops?.length > 0 && (
            <div className="mt-1 text-[11px] opacity-80">
              Cited SOPs: <span className="font-mono">{verdict.cited_sops.join(", ")}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <div>
          <div className="opacity-70">Calls audited</div>
          <div className="text-base font-semibold">{totalCalls}</div>
        </div>
        <div>
          <div className="opacity-70">Calls blocked</div>
          <div className={clsx("text-base font-semibold", blocked > 0 ? "text-rose-300" : "")}>{blocked}</div>
        </div>
      </div>
    </div>
  );
}
