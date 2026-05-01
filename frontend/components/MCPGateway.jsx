"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Shield, Lock, ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { AGENT_META } from "@/lib/agents";

const RISK_TONE = { low: "ok", medium: "warn", high: "danger" };

/**
 * Visible MCP / Safety Gateway audit log.
 *
 * Every tool call from every agent flows through here. Each row shows:
 *   agent → gateway decision → tool → duration
 * Blocked rows are highlighted; the gateway's rejection_reason is shown
 * to make the safety policy completely transparent to the operator.
 */
export default function MCPGateway({ events }) {
  const rows = useMemo(
    () =>
      events.filter((e) => e.type === "tool_call" || e.type === "tool_blocked" || e.type === "tool_result"),
    [events]
  );

  // Collapse tool_call + tool_result pairs into single rows keyed by order.
  const collapsed = useMemo(() => {
    const out = [];
    for (const evt of rows) {
      if (evt.type === "tool_call" || evt.type === "tool_blocked") {
        out.push({
          ...evt.payload,
          status: evt.type === "tool_blocked" ? "blocked" : "approved",
          result: null,
        });
      } else if (evt.type === "tool_result") {
        // attach to most recent approved row matching the tool name
        for (let i = out.length - 1; i >= 0; i--) {
          if (out[i].tool === evt.payload.tool && out[i].result == null) {
            out[i].result = evt.payload.result;
            break;
          }
        }
      }
    }
    return out;
  }, [rows]);

  return (
    <Card className="h-full">
      {/*
        Custom header (not <CardHeader>) because the right-column panel is
        narrow (~25%); the default justify-between layout caused the title
        to wrap onto 3 lines while the badges floated awkwardly. Here the
        title gets its own row, and both badges sit on a tidy second row.
      */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
        <div className="flex-none rounded-xl p-2.5 bg-indigo-100 text-indigo-700">
          <Shield size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink tracking-tight leading-snug">
            MCP Safety Gateway
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">
              <Lock size={10} /> non-overridable
            </Badge>
            <Badge tone="info">
              <span className="font-mono">{collapsed.length}</span> calls
            </Badge>
          </div>
          <div className="mt-2 text-xs text-muted leading-snug">
            Deterministic policy layer between every agent and every MCP tool.
          </div>
        </div>
      </div>
      <CardBody>
        {collapsed.length === 0 && (
          <div className="text-xs text-muted italic py-8 text-center">
            No tool calls yet. Start an investigation to see the audit trail populate live.
          </div>
        )}

        <ol className="space-y-2">
          {collapsed.map((row, idx) => (
            <GatewayRow key={idx} row={row} index={idx + 1} />
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function GatewayRow({ row, index }) {
  const blocked = row.status === "blocked";
  // Pull the per-agent border colour so every row carries a thin accent
  // matching its origin agent. Unknown agents fall back to a neutral border.
  const agentMeta = row.agent ? AGENT_META[row.agent] : null;
  const agentBorder = agentMeta?.border || "before:bg-slate-300";
  return (
    <li
      className={clsx(
        // `before:` pseudo gives a 3px coloured agent stripe on the left edge.
        "relative rounded-xl border p-3 pl-4 text-sm overflow-hidden transition-colors",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px]",
        agentBorder,
        blocked
          ? "border-rose-200 bg-rose-50"
          : "border-border bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted">
          #{String(index).padStart(2, "0")}
        </span>
        <Badge tone="default">{row.agent?.replace("_", " ")}</Badge>
        <ArrowRight size={12} className="text-slate-400" />
        {blocked ? (
          <Badge tone="danger">
            <XCircle size={10} /> blocked
          </Badge>
        ) : (
          <Badge tone="ok">
            <CheckCircle2 size={10} /> approved
          </Badge>
        )}
        <ArrowRight size={12} className="text-slate-400" />
        <span className="font-mono text-ink font-medium">{row.tool}</span>
        {row.risk_level && row.risk_level !== "unknown" && (
          <Badge tone={RISK_TONE[row.risk_level] || "default"}>
            risk: {row.risk_level}
          </Badge>
        )}
        {row.access && row.access !== "unknown" && (
          <Badge
            tone={
              row.access === "read"
                ? "ok"
                : row.access === "draft-only"
                  ? "warn"
                  : "danger"
            }
          >
            {row.access}
          </Badge>
        )}
        {row.duration_ms != null && (
          <span className="ml-auto font-mono text-[11px] text-muted">
            {row.duration_ms} ms
          </span>
        )}
      </div>

      {row.arguments && Object.keys(row.arguments).length > 0 && (
        <div className="mt-1.5 font-mono text-[11px] text-muted truncate">
          args: {JSON.stringify(row.arguments)}
        </div>
      )}

      {blocked && row.rejection_reason && (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-100/60 px-2.5 py-1.5 text-xs text-rose-700">
          <span className="font-semibold">Gateway:</span> {row.rejection_reason}
        </div>
      )}

      {!blocked && row.result && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink select-none">
            View result payload
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-slate-50 p-2 text-[11px] text-slate-700">
            {JSON.stringify(row.result, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}
