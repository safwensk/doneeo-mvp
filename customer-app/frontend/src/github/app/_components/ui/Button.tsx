// New for the frontend redesign (frontend/redesign-main-flow). Tailwind-only,
// uses the `-r` token set added in globals.css. Behavior-neutral: takes the same
// onClick/disabled/type props page.tsx already passes to its raw <button> tags.
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-sans-r font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500-r text-white shadow-[0_9px_22px_rgba(28,107,80,0.28)] hover:bg-brand-600-r",
  secondary:
    "bg-surface-r text-ink-r border border-line-r hover:border-brand-500-r hover:text-brand-600-r",
  ghost: "bg-transparent text-muted-r hover:text-ink-r",
};

const sizes: Record<Size, string> = {
  md: "rounded-xl-r px-5 py-3 text-sm",
  lg: "rounded-xl-r px-6 py-4 text-base w-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
