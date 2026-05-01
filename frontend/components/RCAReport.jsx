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
          <div className="rounded-xl p-2.5 bg-indigo-100 text-indigo-700">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-ink tracking-tight">
              Root Cause Analysis Report
            </div>
            <div className="text-xs text-muted">
              <span className="font-mono">{report.incident_id}</span> ·{" "}
              <span className="font-mono">{report.asset_id}</span> · completed{" "}
              <span className="font-mono">
                {new Date(report.completed_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <VerdictBadge status={report.safety?.status} />
          <Badge tone={conf >= 70 ? "ok" : conf >= 50 ? "warn" : "danger"}>
            Confidence <span className="font-mono ml-0.5">{conf}%</span>
          </Badge>
          <Button variant="ghost" onClick={() => downloadReportMarkdown(report)}>
            <Download size={14} /> Export .md
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Top hypothesis
          </h3>
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-ink leading-snug">
                {report.top_hypothesis.summary}
              </div>
              <Badge tone="accent">
                <span className="font-mono">p={report.top_hypothesis.likelihood}</span>
              </Badge>
            </div>
            {report.top_hypothesis.evidence?.length > 0 && (
              <ul className="mt-2.5 list-disc pl-5 text-xs text-muted space-y-1">
                {report.top_hypothesis.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {report.alternative_hypotheses?.length > 0 && (
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              Alternative hypotheses
            </h3>
            <ul className="space-y-2">
              {report.alternative_hypotheses.map((h, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-slate-50/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-ink">{h.summary}</div>
                    <Badge tone="default">
                      <span className="font-mono">p={h.likelihood}</span>
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Known unknowns
          </h3>
          {report.known_unknowns?.length === 0 && (
            <div className="text-sm text-muted">None. All evidence is consistent.</div>
          )}
          <ul className="space-y-1.5 text-sm">
            {report.known_unknowns?.map((u, i) => (
              <li key={i} className="flex gap-2 text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 flex-none text-amber-600" />
                {u}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Human review checklist. Engineer is the final decision-maker
          </h3>
          <ul className="space-y-2">
            {report.human_review_checklist?.map((item, i) => {
              const Icon = SEVERITY_ICON[item.severity] || Info;
              return (
                <li
                  key={i}
                  className={clsx(
                    "flex items-start gap-3 rounded-xl border p-3.5",
                    item.severity === "critical"
                      ? "border-rose-200 bg-rose-50"
                      : item.severity === "caution"
                        ? "border-amber-200 bg-amber-50"
                        : "border-border bg-slate-50/60"
                  )}
                >
                  <Icon
                    size={16}
                    className={clsx(
                      "mt-0.5 flex-none",
                      item.severity === "critical" && "text-rose-600",
                      item.severity === "caution" && "text-amber-600",
                      item.severity === "info" && "text-sky-600"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-ink">{item.label}</div>
                      <Badge tone={SEVERITY_TONE[item.severity]}>{item.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted mt-0.5">{item.rationale}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-indigo-600 cursor-pointer"
                    aria-label="Acknowledge"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {report.capa_draft && (
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              CAPA Draft. Generated by{" "}
              <code className="font-mono font-medium text-slate-700">
                generate_capa_draft
              </code>
            </h3>
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
              <div className="flex items-center gap-2">
                <FileSignature size={14} className="text-indigo-600" />
                <Badge tone="warn">{report.capa_draft.draft_status}</Badge>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Corrective actions
                  </div>
                  <ul className="list-disc pl-5 text-xs text-ink space-y-1">
                    {report.capa_draft.corrective_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Preventive actions
                  </div>
                  <ul className="list-disc pl-5 text-xs text-ink space-y-1">
                    {report.capa_draft.preventive_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted">
                Approvals required:{" "}
                <span className="text-ink font-medium">
                  {report.capa_draft.approvals_required.join(" · ")}
                </span>
              </div>
            </div>
          </section>
        )}

        <div className="rounded-xl border border-border bg-slate-50/70 p-3.5 text-xs text-muted leading-relaxed">
          <strong className="text-ink">AI disclaimer:</strong> this report is generated
          by an orchestrated set of LLM agents. Every tool call is logged in the MCP
          Gateway audit. The engineer is the final decision-maker. Do not act on any
          item until the human review checklist above is signed off.
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
