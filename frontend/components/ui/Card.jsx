import clsx from "clsx";

export function Card({ className, children, ...rest }) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border bg-panel/80 backdrop-blur-sm",
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
    <div className={clsx("flex items-center justify-between px-4 py-3 border-b border-border", className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={clsx("p-4", className)}>{children}</div>;
}
