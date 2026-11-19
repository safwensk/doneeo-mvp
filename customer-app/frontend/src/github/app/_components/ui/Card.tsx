// New for the frontend redesign. Plain rounded container — the repeated
// "border + radius + white background" wrapper that used to be hand-rolled
// per section (.rules-gate, .route-card, .plan-card, etc.).
import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  padding = "md",
  raised = false,
  className = "",
  children,
  ...rest
}: {
  padding?: "sm" | "md" | "lg" | "none";
  raised?: boolean;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-6" } as const;
  return (
    <div
      className={`rounded-2xl-r border border-line-r bg-surface-r ${
        raised ? "shadow-raised-r" : "shadow-card-r"
      } ${paddings[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
