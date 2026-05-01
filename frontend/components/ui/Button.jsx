import clsx from "clsx";

const variants = {
  primary:
    "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-700 active:translate-y-[1px]",
  ghost:
    "bg-white text-ink border border-border hover:border-indigo-300 hover:bg-indigo-50/50 active:translate-y-[1px]",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-600/30 hover:from-rose-500 hover:to-rose-700 active:translate-y-[1px]",
};

export function Button({ variant = "primary", className, children, ...rest }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25",
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
