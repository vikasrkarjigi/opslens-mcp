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
  const { Icon, label, blurb, accent, ring, bar } = meta;

  const lastMessage = messages[messages.length - 1];
  const confidence = lastMessage?.confidence ?? 0;
  const confPct = Math.round(confidence * 100);

  return (
    <Card className={clsx("transition-shadow", state === "thinking" && `shadow-glow ring-1 ${ring}`)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={clsx("rounded-md p-2 bg-panel2", accent)}>
            <Icon size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">{label}</div>
            <div className="text-xs text-muted">{blurb}</div>
          </div>
        </div>
        <StateBadge state={state} />
      </CardHeader>
      <CardBody className="space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted italic">Waiting for upstream evidence…</div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className="rounded-lg bg-panel2/70 border border-border p-3">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted">
              <span>Round {m.round === 99 ? "final" : m.round}</span>
              <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{m.content}</pre>
            {m.tool_calls?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.tool_calls.map((tc, i) => (
                  <Badge key={i} tone={tc.approved ? "info" : "danger"}>
                    {tc.tool}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}

        {messages.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted">
              <span>Confidence</span>
              <span className="text-ink">{confPct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-panel2 overflow-hidden">
              <div className={clsx("h-full", bar)} style={{ width: `${confPct}%` }} />
            </div>
          </div>
        )}
      </CardBody>
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
