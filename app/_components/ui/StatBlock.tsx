// New for the frontend redesign. The repeated "small label / big value / caption"
// pattern used across estimate strips, gate metrics, blueprint grids, etc.
export function StatBlock({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "accent";
}) {
  return (
    <div>
      <small className="block text-[9px] font-bold uppercase tracking-wider text-brand-600-r">
        {label}
      </small>
      <strong
        className={`mt-1.5 block text-lg leading-tight ${
          tone === "accent" ? "text-accent-r" : "text-ink-r"
        }`}
      >
        {value}
      </strong>
      {caption && <span className="mt-1 block text-xs leading-snug text-muted-r">{caption}</span>}
    </div>
  );
}
