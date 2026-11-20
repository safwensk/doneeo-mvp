// New for the frontend redesign. The persistent chrome above all 4 stages —
// logo, demo nav, and the step progress bar. Replaces .topbar/.demo-nav/
// .progress-track for the redesigned flow only.
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ui/ProgressBar";

const NAV_LINKS = [
  { href: "/architecture", label: "Architecture" },
  { href: "/track", label: "Live tracking" },
  { href: "/provider", label: "Team workspace" },
  { href: "/provider/alex", label: "Alex view" },
  { href: "/data", label: "Test controls →" },
];

export function AppHeader({ stage, progress }: { stage: number; progress: number }) {
  return (
    <>
      <header className="flex h-[76px] items-center justify-between border-b border-line-r px-[5%]">
        <img className="block h-auto w-[168px] max-w-[42vw]" src="/brand/doneeo-logo.png" alt="Doneeo" />
        <nav className="hidden items-center gap-2 md:flex" aria-label="Demo views">
          <Badge tone="brand">Customer planner</Badge>
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-[11px] font-semibold text-muted-r transition-colors hover:bg-canvas-r hover:text-ink-r"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <ProgressBar percent={progress} label={`Step ${stage + 1} of 4`} />
    </>
  );
}
