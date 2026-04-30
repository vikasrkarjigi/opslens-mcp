"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Shield, Lock, ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";

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
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-md p-2 bg-violet-500/15 text-violet-300">
            <Shield size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink flex items-center gap-2">
              MCP Safety Gateway
              <Badge tone="accent">
                <Lock size={10} /> non-overridable
              </Badge>
            </div>
            <div className="text-xs text-muted">
              Deterministic policy layer between every agent and every MCP tool.
            </div>
          </div>
        </div>
        <Badge tone="info">{collapsed.length} calls</Badge>
      </CardHeader>
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
  return (
    <li
      className={clsx(
        "rounded-lg border p-3 text-sm",
        blocked
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-border bg-panel2/60"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">#{String(index).padStart(2, "0")}</span>
        <Badge tone="default">{row.agent?.replace("_", " ")}</Badge>
        <ArrowRight size={12} className="text-muted" />
        {blocked ? (
          <Badge tone="danger">
            <XCircle size={10} /> blocked
          </Badge>
        ) : (
          <Badge tone="ok">
            <CheckCircle2 size={10} /> approved
          </Badge>
        )}
        <ArrowRight size={12} className="text-muted" />
        <span className="font-mono text-ink">{row.tool}</span>
        {row.risk_level && row.risk_level !== "unknown" && (
          <Badge tone={RISK_TONE[row.risk_level] || "default"}>risk: {row.risk_level}</Badge>
        )}
        {row.access && row.access !== "unknown" && (
          <Badge tone={row.access === "read" ? "ok" : row.access === "draft-only" ? "warn" : "danger"}>
            {row.access}
          </Badge>
        )}
        {row.duration_ms != null && (
          <span className="ml-auto text-xs text-muted">{row.duration_ms} ms</span>
        )}
      </div>

      {row.arguments && Object.keys(row.arguments).length > 0 && (
        <div className="mt-1.5 font-mono text-xs text-muted truncate">
          args: {JSON.stringify(row.arguments)}
        </div>
      )}

      {blocked && row.rejection_reason && (
        <div className="mt-2 rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-300">
          Gateway: {row.rejection_reason}
        </div>
      )}

      {!blocked && row.result && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink">
            View result payload
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-bg p-2 text-[11px] text-ink/80">
            {JSON.stringify(row.result, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}
