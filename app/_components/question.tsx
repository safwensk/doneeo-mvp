"use client";

// Restyled for the frontend redesign (frontend/redesign-main-flow) — Tailwind
// utilities on the `-r` token set, behavior unchanged. Only used by page.tsx.
import type { PlannerQuestion } from "../../lib/planner";

function QuestionHeading({ label, help }: { label: string; help?: string }) {
  return (
    <div>
      <strong className="block text-sm font-semibold text-ink-r">{label}</strong>
      {help && <small className="mt-1 block text-xs text-muted-r">{help}</small>}
    </div>
  );
}

function pillClass(active: boolean) {
  return `rounded-full border px-4 py-2.5 text-sm transition-colors ${
    active
      ? "border-brand-500-r bg-brand-50-r text-brand-600-r font-semibold"
      : "border-line-r bg-surface-r text-muted-r hover:border-brand-200-r"
  }`;
}

export function Question({
  question,
  value,
  onChange,
  onTextCommit,
  busy,
}: {
  question: PlannerQuestion;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  onTextCommit: () => void;
  busy: boolean;
}) {
  if (question.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-6 rounded-2xl-r border border-line-r p-4">
        <QuestionHeading label={question.label} help={question.help} />
        <div className="flex flex-none gap-1.5">
          <button className={pillClass(value === true)} onClick={() => onChange(true)}>
            Yes
          </button>
          <button className={pillClass(value === false)} onClick={() => onChange(false)}>
            No
          </button>
        </div>
      </div>
    );
  }

  if (question.type === "choice") {
    return (
      <div className="rounded-2xl-r border border-line-r p-4">
        <QuestionHeading label={question.label} help={question.help} />
        <div className="mt-3 flex flex-wrap gap-2">
          {question.options?.map(option => (
            <button key={option} className={pillClass(value === option)} onClick={() => onChange(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const canSubmit = !busy && typeof value === "string" && value.trim().length >= 2;
  return (
    <div className="rounded-2xl-r border border-line-r bg-surface-r p-4">
      <span className="text-xs font-bold uppercase tracking-wide text-brand-600-r">{question.label}</span>
      <input
        value={typeof value === "string" ? value : ""}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && canSubmit) {
            event.preventDefault();
            onTextCommit();
          }
        }}
        placeholder={question.help || "Enter details"}
        className="mt-2 w-full border-0 border-b border-line-r bg-transparent pb-2 text-sm text-ink-r outline-none focus:border-brand-500-r"
      />
      <small className="mt-2 block text-xs text-muted-r">
        Your answer stays here while you type. Confirm it when you are finished.
      </small>
      <button
        disabled={!canSubmit}
        onClick={onTextCommit}
        className="mt-3 rounded-lg-r border border-brand-500-r bg-surface-r px-4 py-2 text-xs font-bold text-brand-600-r disabled:opacity-40"
      >
        {busy ? "Validating…" : "Confirm answer"}
      </button>
    </div>
  );
}
