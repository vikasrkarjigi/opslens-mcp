"use client";

import clsx from "clsx";
import { AlertTriangle, AlertCircle, Info, User, Clock, Layers } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";

const SEVERITY = {
  critical: { tone: "danger", Icon: AlertCircle, label: "ESCALATED" },
  caution: { tone: "warn", Icon: AlertTriangle, label: "OPEN" },
  info: { tone: "info", Icon: Info, label: "MONITOR" },
};

export default function IncidentSelector({
  incidents,
  selected,
  onSelect,
  onDescriptionChange,
  description,
  disabled,
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <div className="text-sm font-semibold text-ink">Select demo incident</div>
          <div className="text-xs text-muted">3 hand-curated scenarios across the fleet.</div>
        </div>
        <Badge tone="info">{incidents.length} scenarios</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        {incidents.map((inc) => {
          const sev = SEVERITY[inc.severity_hint] || SEVERITY.caution;
          const SevIcon = sev.Icon;
          const active = selected?.incident_id === inc.incident_id;
          return (
            <button
              key={inc.incident_id}
              disabled={disabled}
              onClick={() => {
                onSelect(inc);
                onDescriptionChange(inc.description);
              }}
              className={clsx(
                "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                active
                  ? "border-accent bg-accent/10 shadow-glow"
                  : "border-border bg-panel2 hover:border-accent/50"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={clsx(
                    "rounded-md p-2 flex-none",
                    sev.tone === "danger" && "bg-rose-500/15 text-rose-300",
                    sev.tone === "warn" && "bg-amber-500/15 text-amber-300",
                    sev.tone === "info" && "bg-sky-500/15 text-sky-300"
                  )}
                >
                  <SevIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">{inc.incident_id}</span>
                    <Badge tone={sev.tone}>{sev.label}</Badge>
                  </div>
                  <div className="text-sm font-semibold text-ink mt-0.5 truncate">{inc.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Layers size={10} /> {inc.asset_id}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} /> {inc.shift}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User size={10} /> {inc.reporter}
                    </span>
                    {inc.affected_batch && (
                      <span className="font-mono">batch {inc.affected_batch}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        <div className="pt-2">
          <label className="text-xs text-muted">Operator description (editable)</label>
          <textarea
            value={description}
            disabled={disabled}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-panel2 p-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60"
            placeholder="Describe the symptom in operator language…"
          />
        </div>
      </CardBody>
    </Card>
  );
}
