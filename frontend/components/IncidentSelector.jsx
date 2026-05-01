"use client";

import clsx from "clsx";
import { User, Clock, Layers } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Badge } from "./ui/Badge";

// severity_hint -> visual config. Coloured left border conveys severity
// without the noisy triangle icon.
const SEVERITY = {
  critical: { tone: "danger", label: "ESCALATED", border: "before:bg-rose-500" },
  caution: { tone: "warn", label: "OPEN", border: "before:bg-amber-500" },
  info: { tone: "info", label: "MONITOR", border: "before:bg-sky-500" },
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
                // The `before:` pseudo provides a 4px coloured severity bar
                // pinned to the left edge of the card.
                "relative w-full text-left rounded-xl border px-4 py-3 transition-all overflow-hidden",
                "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
                sev.border,
                active
                  ? "border-indigo-300 bg-indigo-50/60 shadow-glow"
                  : "border-border bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
              )}
            >
              <div className="flex items-start gap-3 pl-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted">{inc.incident_id}</span>
                    <Badge tone={sev.tone}>{sev.label}</Badge>
                  </div>
                  <div className="text-sm font-semibold text-ink mt-1 leading-snug">
                    {inc.title}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Layers size={10} /> <span className="font-mono">{inc.asset_id}</span>
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
          <label className="text-xs font-medium text-muted">
            Operator description (editable)
          </label>
          <textarea
            value={description}
            disabled={disabled}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={4}
            className="focus-ring mt-1 w-full rounded-lg border border-border bg-white p-3 text-sm text-ink placeholder:text-muted disabled:opacity-60 disabled:bg-slate-50"
            placeholder="Describe the symptom in operator language…"
          />
        </div>
      </CardBody>
    </Card>
  );
}
