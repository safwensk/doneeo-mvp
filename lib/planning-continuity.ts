import type { PlannerAnalysis } from "./planner";

// A provider outage must not replace an established WorkCase with a new,
// less-informed interpretation of the original request.
export function savedPlanningFallback(
  snapshot: unknown,
  originalRequest: string,
): PlannerAnalysis | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const prior = snapshot as Partial<PlannerAnalysis>;
  if (
    !Array.isArray(prior.tasks) || !prior.tasks.length ||
    !Array.isArray(prior.questions) || !Array.isArray(prior.routeNodes) ||
    !Array.isArray(prior.understoodFacts) || !prior.extractedAnswers ||
    !prior.estimate || !prior.audit
  ) return null;
  return {
    ...structuredClone(prior as PlannerAnalysis),
    sourceText: originalRequest,
    audit: {
      ...structuredClone(prior.audit),
      status: "deterministic",
    },
  };
}
