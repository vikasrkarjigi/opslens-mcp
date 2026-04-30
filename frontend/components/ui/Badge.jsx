import clsx from "clsx";

const tones = {
  default: "bg-panel2 text-ink border border-border",
  ok: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  info: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  accent: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
};

export function Badge({ tone = "default", className, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
