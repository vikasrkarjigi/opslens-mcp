import clsx from "clsx";

const variants = {
  primary: "bg-accent text-white hover:bg-accent/90",
  ghost: "bg-transparent text-ink hover:bg-panel2 border border-border",
  danger: "bg-danger text-white hover:bg-danger/90",
};

export function Button({ variant = "primary", className, children, ...rest }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
