"use client";

import clsx from "clsx";
import {
  ClipboardCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Download,
  FileSignature,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { downloadReportMarkdown } from "@/lib/report";

const SEVERITY_ICON = {
  critical: AlertCircle,
  caution: AlertTriangle,
  info: Info,
};
const SEVERITY_TONE = {
  critical: "danger",
  caution: "warn",
  info: "info",
};

export default function RCAReport({ report }) {
  if (!report) return null;
  const conf = Math.round(report.confidence * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-md p-2 bg-violet-500/15 text-violet-300">
            <ClipboardCheck size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">Root Cause Analysis Report</div>
            <div className="text-xs text-muted">
              {report.incident_id} · {report.asset_id} · completed{" "}
              {new Date(report.completed_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <VerdictBadge status={report.safety?.status} />
          <Badge tone={conf >= 70 ? "ok" : conf >= 50 ? "warn" : "danger"}>
            Confidence {conf}%
          </Badge>
          <Button variant="ghost" onClick={() => downloadReportMarkdown(report)}>
            <Download size={14} /> Export .md
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Top hypothesis
          </h3>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{report.top_hypothesis.summary}</div>
              <Badge tone="accent">p={report.top_hypothesis.likelihood}</Badge>
            </div>
            {report.top_hypothesis.evidence?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-muted space-y-0.5">
                {report.top_hypothesis.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {report.alternative_hypotheses?.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Alternative hypotheses
            </h3>
            <ul className="space-y-2">
              {report.alternative_hypotheses.map((h, i) => (
                <li key={i} className="rounded-lg border border-border bg-panel2/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-ink">{h.summary}</div>
                    <Badge tone="default">p={h.likelihood}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Known unknowns
          </h3>
          {report.known_unknowns?.length === 0 && (
            <div className="text-sm text-muted">None — all evidence is consistent.</div>
          )}
          <ul className="space-y-1 text-sm text-amber-200">
            {report.known_unknowns?.map((u, i) => (
              <li key={i} className="flex gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-none" />
                {u}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Human review checklist — engineer is the final decision-maker
          </h3>
          <ul className="space-y-2">
            {report.human_review_checklist?.map((item, i) => {
              const Icon = SEVERITY_ICON[item.severity] || Info;
              return (
                <li
                  key={i}
                  className={clsx(
                    "flex items-start gap-3 rounded-lg border p-3",
                    item.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : item.severity === "caution"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border bg-panel2/60"
                  )}
                >
                  <Icon
                    size={16}
                    className={clsx(
                      "mt-0.5 flex-none",
                      item.severity === "critical" && "text-rose-300",
                      item.severity === "caution" && "text-amber-300",
                      item.severity === "info" && "text-sky-300"
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-ink">{item.label}</div>
                      <Badge tone={SEVERITY_TONE[item.severity]}>{item.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted">{item.rationale}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-violet-500"
                    aria-label="Acknowledge"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {report.capa_draft && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              CAPA Draft — generated by <code className="font-mono">generate_capa_draft</code>
            </h3>
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
              <div className="flex items-center gap-2">
                <FileSignature size={14} className="text-violet-300" />
                <Badge tone="warn">{report.capa_draft.draft_status}</Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-muted mb-1">Corrective actions</div>
                  <ul className="list-disc pl-5 text-xs text-ink space-y-0.5">
                    {report.capa_draft.corrective_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted mb-1">Preventive actions</div>
                  <ul className="list-disc pl-5 text-xs text-ink space-y-0.5">
                    {report.capa_draft.preventive_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted">
                Approvals required:{" "}
                <span className="text-ink">
                  {report.capa_draft.approvals_required.join(" · ")}
                </span>
              </div>
            </div>
          </section>
        )}

        <div className="rounded-lg border border-border bg-panel2/40 p-3 text-xs text-muted">
          <strong className="text-ink">AI disclaimer:</strong> this report is generated by an
          orchestrated set of LLM agents. Every tool call is logged in the MCP Gateway
          audit. The engineer is the final decision-maker — do not act on any item until
          the human review checklist above is signed off.
        </div>
      </CardBody>
    </Card>
  );
}

function VerdictBadge({ status }) {
  if (!status) return null;
  if (status === "DO_NOT_RESTART")
    return (
      <Badge tone="danger">
        <ShieldX size={10} /> DO NOT RESTART
      </Badge>
    );
  if (status === "CAUTION_REQUIRED")
    return (
      <Badge tone="warn">
        <AlertTriangle size={10} /> CAUTION
      </Badge>
    );
  return (
    <Badge tone="ok">
      <ShieldCheck size={10} /> CLEAR
    </Badge>
  );
}
