// New for the frontend redesign. Replaces .progress-track for the top-of-page
// 4-stage indicator.
export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className="h-1 w-full bg-line-r" aria-label={label}>
      <span
        className="block h-full bg-brand-500-r transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
