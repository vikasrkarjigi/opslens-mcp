import { Database, Activity, Lightbulb, ShieldAlert, FileText } from "lucide-react";

export const AGENT_META = {
  data_agent: {
    label: "Data Agent",
    blurb: "Reads sensors, specs and maintenance logs verbatim.",
    Icon: Database,
    accent: "text-sky-300",
    ring: "ring-sky-500/40",
    bar: "bg-sky-500",
  },
  pattern_agent: {
    label: "Pattern Agent",
    blurb: "Compares anomalies against the fleet incident history.",
    Icon: Activity,
    accent: "text-emerald-300",
    ring: "ring-emerald-500/40",
    bar: "bg-emerald-500",
  },
  hypothesis_agent: {
    label: "Hypothesis Agent",
    blurb: "Proposes 2–3 root causes with explicit likelihoods.",
    Icon: Lightbulb,
    accent: "text-amber-300",
    ring: "ring-amber-500/40",
    bar: "bg-amber-500",
  },
  safety_critic: {
    label: "Safety Critic",
    blurb: "Veto authority — cannot be overridden by other agents.",
    Icon: ShieldAlert,
    accent: "text-rose-300",
    ring: "ring-rose-500/40",
    bar: "bg-rose-500",
  },
  synthesis_agent: {
    label: "Synthesis Agent",
    blurb: "Writes the final RCA report and lists known unknowns.",
    Icon: FileText,
    accent: "text-violet-300",
    ring: "ring-violet-500/40",
    bar: "bg-violet-500",
  },
};

export const AGENT_ORDER = [
  "data_agent",
  "pattern_agent",
  "hypothesis_agent",
  "safety_critic",
  "synthesis_agent",
];
