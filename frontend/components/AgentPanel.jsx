"use client";

import clsx from "clsx";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { AGENT_META } from "@/lib/agents";

/**
 * Renders one specialised agent's live status, transcript, and confidence.
 *
 * `state` is one of: "idle" | "thinking" | "done"
 * `messages` is the list of AgentMessage objects emitted for this role.
 */
export default function AgentPanel({ role, state, messages }) {
  const meta = AGENT_META[role];
  if (!meta) return null;
  const { Icon, label, blurb, accent, ring, bar, iconBg } = meta;

  const lastMessage = messages[messages.length - 1];
  const confidence = lastMessage?.confidence ?? 0;
  const confPct = Math.round(confidence * 100);

  // Confidence colour: >=70% green, 40-70% amber, <40% red.
  const confTone =
    confPct >= 70 ? "bg-emerald-500" : confPct >= 40 ? "bg-amber-500" : "bg-rose-500";

  return (
    <Card
      className={clsx(
        "relative overflow-hidden transition-all",
        state === "thinking" && `shadow-glow ring-1 ${ring}`,
        state === "idle" && "opacity-90"
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={clsx("rounded-xl p-2.5", iconBg || "bg-slate-100", accent)}>
            <Icon size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-ink tracking-tight">{label}</div>
            <div className="text-xs text-muted">{blurb}</div>
          </div>
        </div>
        <StateBadge state={state} />
      </CardHeader>
      <CardBody className="space-y-3 pb-6">
        {messages.length === 0 && (
          <div className="text-xs text-muted italic">Waiting for upstream evidence…</div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className="rounded-xl bg-panel2/70 border border-border p-3.5"
          >
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted">
              <span>Round {m.round === 99 ? "final" : m.round}</span>
              <span className="font-mono normal-case tracking-normal">
                {new Date(m.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink">
              {m.content}
            </pre>
            {m.tool_calls?.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {m.tool_calls.map((tc, i) => (
                  <Badge key={i} tone={tc.approved ? "info" : "danger"}>
                    <span className="font-mono">{tc.tool}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}

        {messages.length > 0 && (
          <div className="pt-1">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted">
              <span>Confidence</span>
              <span className="font-mono normal-case tracking-normal text-ink">
                {confPct}%
              </span>
            </div>
          </div>
        )}
      </CardBody>

      {/* Confidence bar pinned to the bottom edge of the card. Uses agent-
          coloured accent only while reasoning; once done, switches to a
          quality colour (green / amber / red) so a glance at the column
          tells the engineer which agents are confident. */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100">
        <div
          className={clsx(
            "h-full transition-all duration-500 ease-out",
            messages.length === 0 ? bar : confTone
          )}
          style={{ width: messages.length === 0 ? "0%" : `${confPct}%` }}
        />
      </div>
    </Card>
  );
}

function StateBadge({ state }) {
  if (state === "thinking")
    return (
      <Badge tone="warn">
        <Loader2 size={12} className="animate-spin" /> reasoning
      </Badge>
    );
  if (state === "done")
    return (
      <Badge tone="ok">
        <CheckCircle2 size={12} /> done
      </Badge>
    );
  return <Badge>idle</Badge>;
}
