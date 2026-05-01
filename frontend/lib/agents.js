import { Database, Activity, Lightbulb, ShieldAlert, FileText } from "lucide-react";

// Per-agent visual identity. `accent` is the icon foreground colour (used on
// the soft `iconBg`); `ring` is the focused-card ring; `bar` is the active
// confidence bar; `border` is the left-edge accent on gateway audit rows.
export const AGENT_META = {
  data_agent: {
    label: "Data Agent",
    blurb: "Reads sensors, specs and maintenance logs verbatim.",
    Icon: Database,
    accent: "text-sky-700",
    iconBg: "bg-sky-100",
    ring: "ring-sky-300/60",
    bar: "bg-sky-500",
    border: "before:bg-sky-500",
  },
  pattern_agent: {
    label: "Pattern Agent",
    blurb: "Compares anomalies against the fleet incident history.",
    Icon: Activity,
    accent: "text-emerald-700",
    iconBg: "bg-emerald-100",
    ring: "ring-emerald-300/60",
    bar: "bg-emerald-500",
    border: "before:bg-emerald-500",
  },
  hypothesis_agent: {
    label: "Hypothesis Agent",
    blurb: "Proposes 2 to 3 root causes with explicit likelihoods.",
    Icon: Lightbulb,
    accent: "text-amber-700",
    iconBg: "bg-amber-100",
    ring: "ring-amber-300/60",
    bar: "bg-amber-500",
    border: "before:bg-amber-500",
  },
  safety_critic: {
    label: "Safety Critic",
    blurb: "Veto authority. Cannot be overridden by other agents.",
    Icon: ShieldAlert,
    accent: "text-rose-700",
    iconBg: "bg-rose-100",
    ring: "ring-rose-300/60",
    bar: "bg-rose-500",
    border: "before:bg-rose-500",
  },
  synthesis_agent: {
    label: "Synthesis Agent",
    blurb: "Writes the final RCA report and lists known unknowns.",
    Icon: FileText,
    accent: "text-indigo-700",
    iconBg: "bg-indigo-100",
    ring: "ring-indigo-300/60",
    bar: "bg-indigo-500",
    border: "before:bg-indigo-500",
  },
};

export const AGENT_ORDER = [
  "data_agent",
  "pattern_agent",
  "hypothesis_agent",
  "safety_critic",
  "synthesis_agent",
];
