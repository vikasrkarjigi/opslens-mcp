import clsx from "clsx";

const tones = {
  default: "bg-slate-100 text-slate-700 border border-slate-200",
  ok: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-rose-50 text-rose-700 border border-rose-200",
  info: "bg-sky-50 text-sky-700 border border-sky-200",
  accent: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

export function Badge({ tone = "default", className, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
