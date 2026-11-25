import type { PlannerAnalysis } from "./planner";

export type PlanEdit = { stepId: string; title: string; revision: string };

const boxDestination = /\b(?:to|into)\s+(?:(?:the|my|our)\s+)?(basement garage|storage room|living room|bedroom|basement|bassment|garage|kitchen|attic|main floor|ground floor)(?:\s+in\s+(?:(?:the|my|our)\s+)?(?:basement|bassment))?\b/i;

export function revisedBoxDestination(edit?: PlanEdit) {
  return edit?.stepId === "onsite_box_move" ? edit.revision.match(boxDestination)?.[1]?.toLowerCase() : undefined;
}

export function planEditFor(analysis: PlannerAnalysis | null, input: unknown): PlanEdit | null {
  if (!analysis || !input || typeof input !== "object") return null;
  const { stepId, revision } = input as { stepId?: unknown; revision?: unknown };
  if (typeof stepId !== "string" || typeof revision !== "string") return null;
  const text = revision.trim();
  if (text.length < 3 || text.length > 300) return null;
  const preparation = /^preparation-([1-9]\d*)$/.exec(stepId);
  const step = preparation
    ? analysis.preparation?.[Number(preparation[1]) - 1]?.step
    : analysis.intelligence?.primitives.find(phase => phase.id === stepId)?.label;
  return step ? { stepId, title: step, revision: text } : null;
}

export function revisePlanSource(source: string, edits: readonly PlanEdit[]) {
  const boxEdit = edits.find(edit => edit.stepId === "onsite_box_move");
  if (!boxEdit) return source;
  const boxCount = /\b(?:\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ]five)?)\s+box(?:es)?\b/i;
  const quantity = boxEdit.revision.match(boxCount)?.[0];
  const boxMention = source.match(boxCount);
  if (!boxMention || boxMention.index === undefined) return source;
  const revisedDestination = revisedBoxDestination(boxEdit);
  const prefix = source.slice(0, boxMention.index);
  const originalBoxes = source.slice(boxMention.index);
  const adjusted = originalBoxes.replace(/^[^.;\n]+/, clause => {
    const withQuantity = quantity ? clause.replace(boxCount, quantity) : clause;
    return revisedDestination && boxDestination.test(clause)
      ? withQuantity.replace(boxDestination, `to the ${revisedDestination}`)
      : withQuantity;
  });
  return prefix + adjusted;
}

export function attachPlanEdits(analysis: PlannerAnalysis, edits: PlanEdit[]): PlannerAnalysis {
  const { intelligence } = analysis;
  if (!intelligence || !edits.length) return { ...analysis, planEdits: edits, planConfirmed: false };
  const revisions = new Map(edits.map(edit => [edit.stepId, edit.revision]));
  return {
    ...analysis,
    planConfirmed: false,
    planEdits: edits,
    intelligence: {
      ...intelligence,
      primitives: intelligence.primitives.map(phase => {
        const revision = revisions.get(phase.id);
        return revision ? { ...phase, dependencies: [...phase.dependencies, `Customer instruction: ${revision}`] } : phase;
      }),
      facts: [...intelligence.facts, ...edits.map(edit => ({
        key: `plan_edit_${edit.stepId}`,
        label: edit.title,
        value: edit.revision,
        source: "customer_answer" as const,
        confidence: "confirmed" as const,
      }))],
    },
  };
}
