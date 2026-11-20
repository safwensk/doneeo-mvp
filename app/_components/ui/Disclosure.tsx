// New for the frontend redesign. Styled wrapper on native <details>/<summary> —
// keeps built-in keyboard/a11y behavior while giving the dense technical panels
// (rules gate, intelligence workbench, fact ledger, equations) a collapsed-by-
// default home instead of always being on screen.
import type { ReactNode } from "react";

export function Disclosure({
  summary,
  defaultOpen = false,
  className = "",
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={`group rounded-2xl-r border border-line-r bg-surface-r ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-ink-r marker:content-none [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="text-muted-r transition-transform duration-150 group-open:rotate-180" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="border-t border-line-r px-5 py-4">{children}</div>
    </details>
  );
}
