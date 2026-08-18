import type { PlannerAnalysis } from "../planner";
import type { TaskIdentity } from "../intelligence-task-identity";
import { taskSemanticKey } from "../intelligence-task-identity";
import type { TaskBlockAcceptanceProjection } from "./requirement-contract-hashing";

/**
 * Project the current Intelligence result into provider-neutral, provider-
 * accepted TaskBlock requirements. This is intentionally deterministic.
 */
export function buildTaskAcceptanceProjections(
  analysis: PlannerAnalysis,
  identities: readonly TaskIdentity[],
): TaskBlockAcceptanceProjection[] {
  const intelligence = analysis.intelligence;
  if (!intelligence || !intelligence.estimate.ready || intelligence.unresolved.length) {
    throw new Error("Requirement Contract projection requires requirement-ready Job Intelligence");
  }
  if (analysis.rulesGate?.status !== "cleared") throw new Error("Requirement Contract projection requires a cleared deterministic Rules Gate");

  const active = identities.filter(task => task.status === "ACTIVE");
  return intelligence.workstreams.map(stream => {
    const identity = active.find(task => task.semanticKey === taskSemanticKey(stream.title, stream.domain));
    if (!identity) throw new Error(`no stable TaskBlock identity for ${stream.title}`);
    const phases = intelligence.primitives.filter(phase => stream.phaseIds.includes(phase.id));
    const resources = intelligence.resources.filter(resource => stream.resourceIds.includes(resource.id));
    return {
      requirementId: identity.taskId,
      scope: {
        requestedOutcome: stream.title,
        domain: stream.domain,
        phases: phases.map(phase => ({ id: phase.id, label: phase.label, quantity: phase.quantity, dependencies: phase.dependencies })),
      },
      qualification: stream.qualification,
      crew: { minimum: stream.minimumCrew, recommended: stream.recommendedCrew },
      duration: { likelyMinutes: stream.likelyMinutes, rangeLow: stream.rangeLow, rangeHigh: stream.rangeHigh },
      equipmentAndMaterials: resources.map(resource => ({ id: resource.id, name: resource.name, kind: resource.kind, resolution: resource.resolution })),
      accessAndLocations: {
        routeNodes: analysis.routeNodes,
        accessFacts: intelligence.facts.filter(fact => /stop_|floor|elevator|access|parking|entrance/i.test(`${fact.key} ${fact.label}`)),
      },
      temporalConstraints: {
        arrival: analysis.scheduleWindow?.arrivalTime || null,
        deadline: analysis.scheduleWindow?.deadlineTime || null,
        preparationStart: (analysis.scheduleWindow as (typeof analysis.scheduleWindow & { preparationStartTime?: string }))?.preparationStartTime || null,
      },
      dependencies: phases.flatMap(phase => phase.dependencies),
      completionCriteria: [stream.completionGate],
      ruleDecisions: {
        providerClass: analysis.rulesGate?.providerClass,
        riskLevel: analysis.rulesGate?.riskLevel,
        safeguards: analysis.rulesGate?.safeguards || [],
        blockingIssues: (analysis.rulesGate?.issues || []).filter(issue => issue.severity === "block").map(issue => issue.code),
      },
    };
  });
}
