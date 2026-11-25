// New for the frontend redesign. Stage 0 — the customer's opening request.
// Same state/handlers as before (request, setRequest, analyzeRequest,
// plannerState); only the presentation changes. No comic illustration/motion
// graphics carried over — restrained per the agreed direction.
import { Button } from "./ui/Button";

const SUGGESTIONS = [
  {
    label: "Move a couch",
    request:
      "Pick up a couch from a Marketplace seller and carry it to my third-floor apartment. I cannot help lift.",
  },
  {
    label: "Weekly cleaning",
    request: "Clean my three-bedroom house every week, including kitchen and two bathrooms",
  },
  { label: "Install furniture", request: "Assemble and secure a wardrobe in my bedroom" },
  {
    label: "Support a parent",
    request: "Help my elderly father with groceries, companionship and a weekly wellness visit",
  },
];

export function HeroIntake({
  request,
  setRequest,
  analyzeRequest,
  plannerState,
}: {
  request: string;
  setRequest: (value: string) => void;
  analyzeRequest: () => void;
  plannerState: string;
}) {
  const thinking = plannerState === "thinking";
  return (
    <section className="mx-auto max-w-[720px] px-[7%] pb-16 pt-16 md:pt-20">
      <div className="mb-4 text-xs font-bold tracking-[0.17em] text-brand-600-r">
        FROM PROBLEM TO COMPLETE WORK ORDER
      </div>
      <h1 className="font-sans-r text-[clamp(38px,7vw,64px)] font-extrabold leading-[1.02] tracking-tight text-ink-r">
        What needs to get done?
      </h1>
      <p className="mt-5 max-w-[560px] text-lg leading-relaxed text-muted-r">
        Describe the outcome. Doneeo will determine the steps, people, equipment, travel, safety
        constraints and price.
      </p>

      <label className="mt-8 block rounded-2xl-r border border-line-r bg-surface-r px-5 pb-3 pt-4 shadow-card-r focus-within:border-brand-500-r focus-within:shadow-raised-r">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-600-r">
          Describe your request
        </span>
        <textarea
          value={request}
          onChange={event => setRequest(event.target.value)}
          rows={5}
          className="mt-2 w-full resize-none border-0 bg-transparent text-lg leading-relaxed text-ink-r outline-none placeholder:text-subtle-r"
        />
        <small className="text-subtle-r">
          You do not need to know the job category or what resources it requires.
        </small>
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map(item => (
          <button
            key={item.label}
            onClick={() => setRequest(item.request)}
            className="rounded-full border border-line-r bg-surface-r px-4 py-2.5 text-sm text-ink-r/80 transition-colors hover:border-brand-500-r hover:bg-brand-50-r hover:text-brand-600-r"
          >
            {item.label}
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        className="mt-8"
        onClick={analyzeRequest}
        disabled={request.trim().length < 10 || thinking}
      >
        {thinking ? "Planning, then independently validating…" : "Architect my job"}
        <span aria-hidden="true">→</span>
      </Button>
    </section>
  );
}
