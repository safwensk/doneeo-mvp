import type { PlannerAnalysis } from "../../lib/planner";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export type PlanReviewEditor = { stepId: string; revision: string };

type ReviewStep = {
  id: string;
  title: string;
  detail?: string;
  editable: boolean;
};

type ReviewTask = {
  id: string;
  title: string;
  steps: ReviewStep[];
  resources: string[];
  review?: string;
};

type PlanReviewProps = {
  analysis: PlannerAnalysis;
  busy: boolean;
  error?: string;
  confirmed?: boolean;
  title?: string;
  editor: PlanReviewEditor | null;
  setEditor: (editor: PlanReviewEditor | null) => void;
  onEdit: (stepId: string, revision: string) => Promise<boolean>;
  onConfirm: () => Promise<void> | void;
  onBack?: () => void;
};

function focusStepChange(field: HTMLTextAreaElement | null) {
  field?.focus();
}

function focusReviewHeading(heading: HTMLHeadingElement | null) {
  heading?.focus();
}

function reviewTasks(analysis: PlannerAnalysis): ReviewTask[] {
  const intelligence = analysis.intelligence;
  const streams = [...(intelligence?.workstreams ?? [])].sort((a, b) => a.sequence - b.sequence);
  const primitives = new Map(intelligence?.primitives.map(step => [step.id, step]));
  const resources = new Map(intelligence?.resources.map(resource => [resource.id, resource.name]));
  const assigned = new Set<string>();
  const createTask = (id: string, title: string, workstreamIds: string[]): ReviewTask => {
    const members = streams.filter(stream => workstreamIds.includes(stream.id) && !assigned.has(stream.id));
    return {
      id,
      title,
      steps: members.flatMap(stream => {
        assigned.add(stream.id);
        return stream.phaseIds.flatMap(stepId => {
          const step = primitives.get(stepId);
          if (!step) return [];
          const detail = step.locationIndex === undefined ? undefined : analysis.routeNodes[step.locationIndex]?.location;
          return [{ id: stepId, title: step.label, detail, editable: true }];
        });
      }),
      resources: [...new Set(members.flatMap(stream => stream.resourceIds.flatMap(id => {
        const name = resources.get(id);
        return name ? [name] : [];
      })))],
      review: members.at(-1)?.completionGate,
    };
  };
  const blocks = [...(analysis.taskBlocks ?? [])].sort((a, b) => a.sequence - b.sequence)
    .map(block => createTask(block.id, block.title, block.workstreamIds))
    .filter(block => block.steps.length);
  for (const stream of streams) {
    if (!assigned.has(stream.id)) blocks.push(createTask(stream.id, stream.title, [stream.id]));
  }
  const representedSteps = new Set(blocks.flatMap(block => block.steps.map(step => step.id)));
  const remaining = [...primitives.values()].filter(step => !representedSteps.has(step.id));
  if (remaining.length) {
    blocks.push({
      id: "remaining-steps",
      title: "Additional work",
      steps: remaining.map(step => ({ id: step.id, title: step.label, editable: true })),
      resources: [],
    });
  }
  if (!blocks.length) {
    const steps = analysis.executionSteps.length ? analysis.executionSteps : analysis.tasks;
    blocks.push({
      id: "work-plan",
      title: "Work plan",
      steps: steps.map((title, index) => ({ id: `step-${index + 1}`, title, editable: false })),
      resources: [],
    });
  }
  return blocks;
}

function ReviewSteps({ steps, busy, editor, setEditor, analysis, onEdit, error }: Pick<PlanReviewProps, "busy" | "editor" | "setEditor" | "analysis" | "onEdit" | "error"> & { steps: ReviewStep[] }) {
  const savedEdits = new Map(analysis.planEdits?.map(edit => [edit.stepId, edit.revision]));
  return (
    <ol className="mt-4 grid gap-3">
      {steps.map((step, index) => {
        const savedRevision = savedEdits.get(step.id);
        const activeEditor = editor?.stepId === step.id ? editor : null;
        return (
          <li key={step.id} className="rounded-xl-r border border-line-r bg-canvas-r px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block break-words text-sm text-ink-r">{index + 1}. {step.title}</strong>
                {step.detail && <p className="mt-1 break-words text-xs text-muted-r">{step.detail}</p>}
                {savedRevision && <p className="mt-2 break-words text-sm text-brand-600-r">{savedRevision}</p>}
              </div>
              {step.editable && !activeEditor && (
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-brand-600-r hover:bg-brand-50-r disabled:opacity-40"
                  disabled={busy || editor !== null}
                  aria-label={`Edit ${step.title}`}
                  onClick={() => setEditor({ stepId: step.id, revision: savedRevision ?? "" })}
                >
                  Edit step
                </button>
              )}
            </div>
            {activeEditor && (
              <form
                className="mt-3 grid gap-2"
                onSubmit={async event => {
                  event.preventDefault();
                  const revision = activeEditor.revision.trim();
                  if (revision.length < 3 || busy) return;
                  if (await onEdit(step.id, revision)) setEditor(null);
                }}
              >
                <label htmlFor={`review-step-${step.id}`} className="text-xs font-semibold text-ink-r">What should change in this step?</label>
                <textarea
                  id={`review-step-${step.id}`}
                  ref={focusStepChange}
                  rows={3}
                  required
                  minLength={3}
                  maxLength={300}
                  disabled={busy}
                  className="w-full resize-y rounded-lg-r border border-line-r bg-surface-r px-3 py-2 text-sm text-ink-r focus:border-brand-500-r focus:outline-none"
                  value={activeEditor.revision}
                  onChange={event => setEditor({ stepId: step.id, revision: event.currentTarget.value })}
                />
                {error && <p role="alert" className="text-sm text-[#9b2c2c]">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy || activeEditor.revision.trim().length < 3}>
                    {busy ? "Saving…" : "Save change"}
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditor(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function PlanReview({
  analysis,
  busy,
  error,
  confirmed,
  title = "Review your job plan",
  editor,
  setEditor,
  onEdit,
  onConfirm,
  onBack,
}: PlanReviewProps) {
  const tasks = reviewTasks(analysis);
  const preparation = analysis.preparation.map((step, index) => ({
    id: `preparation-${index + 1}`,
    title: step.step,
    editable: true,
  }));
  const stepEditor = { analysis, busy, editor, setEditor, onEdit, error };
  const arrival = analysis.scheduleWindow?.arrivalTime && analysis.scheduleWindow.arrivalLabel;
  return (
    <section aria-labelledby="job-plan-review-title" className="grid gap-4">
      <div>
        <h2 id="job-plan-review-title" ref={focusReviewHeading} tabIndex={-1} className="text-2xl font-extrabold leading-tight text-ink-r">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-r">
          Review the tasks in order and edit any step before confirming. Doneeo will show the available options after you confirm.
        </p>
        {arrival && (
          <p className="mt-2 text-xs font-semibold text-ink-r">
            Requested arrival {arrival}
            {analysis.scheduleWindow?.deadlineLabel && ` · Complete ${analysis.scheduleWindow.deadlineLabel}`}
          </p>
        )}
      </div>
      {preparation.length > 0 && (
        <Card className="bg-brand-50-r/40">
          <h3 className="text-base font-bold text-ink-r">Before arrival</h3>
          <ReviewSteps steps={preparation} {...stepEditor} />
        </Card>
      )}
      {tasks.map((task, index) => (
        <Card key={task.id}>
          <h3 className="text-base font-bold text-ink-r">{index + 1}. {task.title}</h3>
          <ReviewSteps steps={task.steps} {...stepEditor} />
          {task.resources.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted-r">
              <strong className="text-ink-r">Equipment and supplies</strong> · {task.resources.join(", ")}
            </p>
          )}
          {task.review && (
            <p className="mt-3 text-xs leading-relaxed text-muted-r">
              {index < tasks.length - 1
                ? "Confirm this task is complete before the next task begins."
                : "Confirm the final result to complete the job."}
            </p>
          )}
        </Card>
      ))}
      {error && !editor && (
        <p role="alert" className="rounded-xl-r border border-[#efcaca] bg-[#fff1f1] px-4 py-3 text-sm text-[#9b2c2c]">{error}</p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onBack && <Button type="button" variant="ghost" disabled={busy || editor !== null} onClick={onBack}>Back to conversation</Button>}
        <Button type="button" disabled={busy || editor !== null} onClick={() => void onConfirm()}>
          {busy && !editor ? "Confirming plan…" : confirmed ? "View options" : "Confirm plan and see options"}
        </Button>
      </div>
    </section>
  );
}
