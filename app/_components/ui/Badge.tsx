// New for the frontend redesign. Small pill label — replaces the many
// hand-rolled ".xxx-chip"/".xxx-status" span patterns in the old CSS.
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "brand" | "neutral" | "warning" | "danger";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50-r text-brand-600-r",
  neutral: "bg-canvas-r text-muted-r",
  warning: "bg-[#fff3e8] text-[#9c4b22]",
  danger: "bg-[#ffe1dd] text-[#a52d25]",
};

export function Badge({
  tone = "brand",
  className = "",
  children,
  ...rest
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
