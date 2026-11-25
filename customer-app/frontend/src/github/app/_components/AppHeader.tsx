import { useEffect, useRef } from "react";
import { Check, ChevronDown, CircleUserRound, LogOut, Plus } from "lucide-react";
import { ProgressBar } from "./ui/ProgressBar";

const STEPS = ["Conversation", "Review plan", "Planning options", "Progress"];
const TOOLS = [
  { href: "/architecture", label: "Architecture" },
  { href: "/track", label: "Live tracking" },
  { href: "/provider", label: "Team workspace" },
  { href: "/provider/alex", label: "Alex view" },
  { href: "/data", label: "Test controls" },
];

export function AppHeader({ stage, progress, onSignOut, onNewRequest }: {
  stage: number; progress: number; onSignOut: () => void; onNewRequest: () => void;
}) {
  const account = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const showPreviewTools = typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  useEffect(() => {
    const menu = account.current;
    const root = menu?.getRootNode();
    if (!menu || !root) return;
    const outside = (event: Event) => {
      if (!event.composedPath().includes(menu)) menu.open = false;
    };
    const escape = (event: Event) => {
      if ((event as KeyboardEvent).key === "Escape" && menu.open) {
        menu.open = false;
        trigger.current?.focus();
      }
    };
    root.addEventListener("pointerdown", outside);
    root.addEventListener("keydown", escape);
    return () => {
      root.removeEventListener("pointerdown", outside);
      root.removeEventListener("keydown", escape);
    };
  }, []);
  function action(callback: () => void) {
    if (account.current) account.current.open = false;
    callback();
  }
  return <div className="sticky top-0 z-40 bg-surface-r">
    <header className="flex h-[72px] items-center justify-between gap-4 border-b border-line-r px-5 sm:px-[5%]">
      <img className="block h-auto w-[138px] sm:w-[156px]" src="/brand/doneeo-logo.png" alt="Doneeo" />
      <nav className="hidden md:block" aria-label="Your request progress">
        <ol className="flex items-center gap-5">
          {STEPS.map((label, index) => <li key={label} aria-current={index === stage ? "step" : undefined}
            className={`flex items-center gap-2 text-xs ${index === stage ? "font-semibold text-brand-600-r" : "text-muted-r"}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full ${index <= stage ? "bg-brand-50-r text-brand-600-r" : "bg-canvas-r text-muted-r"}`}>
              {index < stage ? <Check size={13} aria-hidden="true" /> : index + 1}
            </span>
            {label}
          </li>)}
        </ol>
      </nav>
      <span className="text-xs text-muted-r md:hidden">{stage + 1} of {STEPS.length}</span>
      <details ref={account} className="relative shrink-0">
        <summary ref={trigger} aria-label="Account menu" className="flex cursor-pointer list-none items-center gap-2 rounded-full p-2 text-muted-r hover:bg-canvas-r focus-visible:outline-2 focus-visible:outline-brand-500-r [&::-webkit-details-marker]:hidden">
          <CircleUserRound size={22} aria-hidden="true" />
          <span className="hidden text-sm sm:inline">Account</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="absolute right-0 top-full mt-2 w-[224px] rounded-xl-r border border-line-r bg-surface-r p-2 shadow-raised-r">
          <button onClick={() => action(onNewRequest)} className="flex w-full items-center gap-2 rounded-lg-r px-3 py-3 text-left text-sm text-ink-r hover:bg-canvas-r"><Plus size={16} aria-hidden="true" />New request</button>
          {showPreviewTools && <details className="border-y border-line-r">
            <summary className="cursor-pointer px-3 py-3 text-xs text-muted-r">Preview tools</summary>
            <nav aria-label="Preview tools" className="pb-2">{TOOLS.map(link =>
              <a key={link.href} href={`http://localhost:5174${link.href}`} target="_blank" rel="noreferrer"
                className="block rounded-lg-r px-4 py-2 text-xs text-muted-r hover:bg-canvas-r hover:text-ink-r">{link.label}</a>)}
            </nav>
          </details>}
          <button onClick={() => action(onSignOut)} className="flex w-full items-center gap-2 rounded-lg-r px-3 py-3 text-left text-sm text-ink-r hover:bg-canvas-r"><LogOut size={16} aria-hidden="true" />Log out</button>
        </div>
      </details>
    </header>
    <ProgressBar percent={progress} label={`Step ${stage + 1} of ${STEPS.length}: ${STEPS[stage]}`} />
  </div>;
}
