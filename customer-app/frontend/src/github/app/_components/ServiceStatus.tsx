import { ChevronDown, Info } from "lucide-react";

export function ServiceStatus({ mode }: { mode: string }) {
  if (!mode.includes("fallback")) return null;
  const saved = mode.startsWith("saved-plan");
  return <div role="status" className="mx-auto mt-3 max-w-[850px] px-5 md:px-8">
    <details className="rounded-xl-r bg-canvas-r px-4 py-3 text-xs text-muted-r">
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <Info size={14} className="shrink-0" aria-hidden="true" />
        <span className="flex-1">{saved ? "AI is temporarily busy. Your progress is saved." : "AI is temporarily busy. Please review this draft."}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <p className="mt-3 border-t border-line-r pt-3 leading-relaxed">{saved
        ? "Your plan and confirmed answers are preserved. Doneeo is continuing with its planning rules while the AI service is unavailable."
        : "Doneeo used its planning rules for this draft. Review the scope and assumptions before continuing."}</p>
    </details>
  </div>;
}
