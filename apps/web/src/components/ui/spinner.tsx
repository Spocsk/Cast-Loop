"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  const classes = ["spinner", `spinner-${size}`, className].filter(Boolean).join(" ");

  return (
    <span className={classes} aria-hidden={label ? undefined : true} role={label ? "status" : undefined}>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
