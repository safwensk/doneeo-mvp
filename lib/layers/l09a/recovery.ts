/**
 * L09A — the fastest-safe-solution search.
 *
 * The ten options below, in this order, are printed on the L09A board's SPECIAL
 * CONTROL panel — a panel the v2.1 reconciliation dropped entirely. The order is
 * the architecture, not a preference: cheapest preservation of committed work
 * first, broad replanning and cancellation last.
 *
 *    1  current executor
 *    2  small resource adjustment
 *    3  redistribute team/resources
 *    4  add helper/specialist
 *    5  continue unaffected TaskBlocks
 *    6  replace affected role/provider
 *    7  prerequisite branch
 *    8  targeted TaskBlock rearchitecture
 *    9  full JobOrder replan
 *   10  cancel affected scope — last resort
 *
 * Two canonical rules constrain what the search may return:
 *
 *   "Solution before broad replanning" — options 9 and 10 are reachable only
 *   after the rest have been offered and refused.
 *
 *   "Physical reality is authoritative but cannot bypass controls" — reality
 *   changes what is true, never what is permitted. An R4 hold stands until L3
 *   clears it, no matter how convenient a recovery would be.
 */

import {
  type ImpactClass, type RealityCase, RealityInvariantError, unaffectedTaskIds,
} from "./reality";

export type RecoveryOptionKind =
  | "CURRENT_EXECUTOR"
  | "SMALL_RESOURCE_ADJUSTMENT"
  | "REDISTRIBUTE_TEAM"
  | "ADD_SPECIALIST"
  | "CONTINUE_UNAFFECTED"
  | "REPLACE_ROLE"
  | "PREREQUISITE_BRANCH"
  | "TARGETED_REARCHITECTURE"
  | "FULL_REPLAN"
  | "CANCEL_AFFECTED_SCOPE";

/** The canonical search order. Index is position in the hierarchy, not severity. */
export const RECOVERY_HIERARCHY: readonly RecoveryOptionKind[] = Object.freeze([
  "CURRENT_EXECUTOR", "SMALL_RESOURCE_ADJUSTMENT", "REDISTRIBUTE_TEAM", "ADD_SPECIALIST",
  "CONTINUE_UNAFFECTED", "REPLACE_ROLE", "PREREQUISITE_BRANCH", "TARGETED_REARCHITECTURE",
  "FULL_REPLAN", "CANCEL_AFFECTED_SCOPE",
]);

/** Options that abandon committed work. Reachable only when nothing else is viable. */
const LAST_RESORT: ReadonlySet<RecoveryOptionKind> =
  new Set(["FULL_REPLAN", "CANCEL_AFFECTED_SCOPE"]);

export type RecoveryOption = {
  readonly kind: RecoveryOptionKind;
  readonly taskIds: readonly string[];
  readonly viable: boolean;
  readonly reason: string;
  /** True when this option changes what successful work requires. */
  readonly changesRequirement: boolean;
  /** True when it needs the customer to agree before it can be applied. */
  readonly needsCustomerApproval: boolean;
};

export type RecoveryDecision = {
  readonly realityCaseId: string;
  readonly selected: RecoveryOption | null;
  /** Every option considered, in hierarchy order, with why each was rejected. */
  readonly considered: readonly RecoveryOption[];
  /** Where this routes next. L09A decides the path; it does not walk it. */
  readonly routeTo: RouteTarget[];
  readonly continuingTaskIds: readonly string[];
  readonly heldTaskIds: readonly string[];
  readonly unrecoverable: boolean;
  readonly needsCustomerApproval: boolean;
};

export type RouteTarget =
  | "L2_TARGETED_REANALYSIS"
  | "L3_SAFETY_RECLASSIFICATION"
  | "L4_L5_RESOURCE_RECOVERY"
  | "L7_RESCHEDULE_OR_CANCEL"
  | "L13_BRANCH"
  | "L09B_RESPONSIBILITY"
  | "L10_RESUME";

export type RecoverySearch = {
  /** Offer options in hierarchy order. May return fewer than asked. */
  evaluate(input: {
    readonly kind: RecoveryOptionKind;
    readonly realityCase: RealityCase;
    readonly affectedTaskIds: readonly string[];
  }): RecoveryOption | null;
};

/**
 * Where a class routes, independent of which recovery option is chosen.
 *
 * This mapping is the R0–R5 table from the board. It is a lookup, not a ladder:
 * a case carrying both R2 and R4 routes to L4/L5 *and* L3, and neither
 * "outranks" the other.
 */
function routesFor(impact: ImpactClass): readonly RouteTarget[] {
  switch (impact) {
    case "R0": return [];
    case "R1": return [];
    case "R2": return ["L4_L5_RESOURCE_RECOVERY"];
    case "R3": return ["L2_TARGETED_REANALYSIS"];
    case "R4": return ["L3_SAFETY_RECLASSIFICATION"];
    case "R5": return ["L13_BRANCH"];
  }
}

/**
 * Walk the hierarchy and take the first viable option.
 *
 * `allTaskIds` and `dependsOn` are needed because option 5 — continue unaffected
 * TaskBlocks — is a real recovery, not a consolation prize. Very often the
 * correct answer is that most of the job proceeds while one task waits.
 */
export function decideRecovery(input: {
  realityCase: RealityCase;
  allTaskIds: readonly string[];
  dependsOn: Readonly<Record<string, readonly string[]>>;
  search: RecoverySearch;
}): RecoveryDecision {
  const { realityCase: rc, allTaskIds, dependsOn, search } = input;
  if (rc.classifications.length === 0) {
    throw new RealityInvariantError("NOTHING_CLASSIFIED", "cannot decide recovery before any observation is classified");
  }

  const continuing = unaffectedTaskIds({ realityCase: rc, allTaskIds, dependsOn });
  const affected = allTaskIds.filter(id => !continuing.includes(id));

  const considered: RecoveryOption[] = [];
  let selected: RecoveryOption | null = null;

  for (const kind of RECOVERY_HIERARCHY) {
    // Solution before broad replanning: a last-resort option is only offered
    // once every preserving option above it has been considered and refused.
    if (LAST_RESORT.has(kind) && considered.some(o => o.viable)) break;

    const option = search.evaluate({ kind, realityCase: rc, affectedTaskIds: affected });
    if (!option) continue;
    if (option.kind !== kind) {
      throw new RealityInvariantError("SEARCH_ORDER", `search returned ${option.kind} when asked for ${kind}`);
    }
    considered.push(option);
    if (option.viable) { selected = option; break; }
  }

  const routes = new Set<RouteTarget>();
  for (const c of rc.classifications) for (const r of routesFor(c.impact)) routes.add(r);
  if (selected?.kind === "PREREQUISITE_BRANCH") routes.add("L13_BRANCH");
  if (selected?.kind === "TARGETED_REARCHITECTURE" || selected?.kind === "FULL_REPLAN") {
    routes.add("L2_TARGETED_REANALYSIS");
  }
  if (selected?.kind === "CANCEL_AFFECTED_SCOPE" || selected === null) {
    routes.add("L7_RESCHEDULE_OR_CANCEL");
  }
  if (selected && !LAST_RESORT.has(selected.kind) && continuing.length > 0) {
    routes.add("L10_RESUME");
  }

  return Object.freeze({
    realityCaseId: rc.realityCaseId,
    selected,
    considered: Object.freeze(considered),
    routeTo: Object.freeze([...routes]) as RouteTarget[],
    continuingTaskIds: continuing,
    heldTaskIds: rc.heldTaskIds,
    unrecoverable: selected === null,
    needsCustomerApproval: selected?.needsCustomerApproval ?? false,
  });
}

/**
 * Work noticed on site that the current job does not need.
 *
 * Canon, twice: "independent observed work never becomes current billable scope
 * without consent", and R5 "remains CandidateFollowUp unless a necessary
 * prerequisite and approved". This type has no price and cannot be executed —
 * it is a suggestion that L13 may turn into a branch if the customer agrees.
 */
export type CandidateFollowUp = {
  readonly realityCaseId: string;
  readonly observationId: string;
  readonly statement: string;
  readonly evidenceRefs: readonly string[];
  /** Always false here. Only L13, with consent, may change that. */
  readonly consented: false;
  /** Always false here. R5 work is never part of the current JobOrder. */
  readonly inCurrentScope: false;
};

export function candidateFollowUpFrom(rc: RealityCase, observationId: string): CandidateFollowUp {
  const obs = rc.observations.find(o => o.observationId === observationId);
  if (!obs) throw new RealityInvariantError("UNKNOWN_OBSERVATION", `no observation ${observationId} on this RealityCase`);
  const cls = rc.classifications.find(c => c.taskId === obs.taskId);
  if (cls?.impact !== "R5") {
    throw new RealityInvariantError(
      "NOT_INDEPENDENT_WORK",
      `only R5 becomes a CandidateFollowUp; this observation is ${cls?.impact ?? "unclassified"}`,
    );
  }
  return Object.freeze({
    realityCaseId: rc.realityCaseId,
    observationId,
    statement: obs.statement,
    evidenceRefs: obs.evidenceRefs,
    consented: false,
    inCurrentScope: false,
  });
}

/**
 * No safe or viable recovery exists, or the customer declined the one that did.
 * Hands off to L7's cancellation path — which is why L7 consumes
 * RealityCase.Unrecoverable, and why that event had to be given a producer.
 */
export function markUnrecoverable(rc: RealityCase): RealityCase {
  return Object.freeze({ ...rc, status: "UNRECOVERABLE" as const });
}
