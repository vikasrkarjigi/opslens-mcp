import clsx from "clsx";

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border bg-panel shadow-card transition-shadow hover:shadow-cardHover",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 px-5 py-4 border-b border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}
