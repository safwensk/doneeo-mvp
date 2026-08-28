/**
 * L09A — Reality & Recovery Decision.
 *
 * Runs when what is actually on site differs from the approved plan. Its job is
 * to preserve as much committed work as possible and find the fastest safe way
 * forward — not to decide who pays for it. That is L09B, and the separation is
 * load-bearing: merging reality with responsibility is what produced three
 * contradictory Layer 9 posters in the first place.
 *
 * THREE THINGS ARE STRUCTURAL HERE
 *
 * 1. R0–R5 ARE SEMANTIC CLASSES, NOT A SEVERITY LADDER. This is the single most
 *    repeated invariant in the reconciliation, and every superseded 09A variant
 *    got it wrong. R4 is not "worse" than R3; they are different *kinds* of
 *    mismatch that route to different owners. There is deliberately no ordering,
 *    no comparison helper and no numeric mapping in this module, and a test
 *    asserts none appears.
 *
 * 2. THE CLASSIFIER IS INJECTED, NOT IMPLEMENTED. Deciding whether a discovered
 *    condition is R3 (the job's requirements changed) or R5 (unrelated new work)
 *    determines whether the customer can be billed for it. No source in the
 *    architecture says who owns that call — it is open ruling OR-1. Writing a
 *    classifier here would answer it by accident, so the port stays a port.
 *
 * 3. IMPACT IS PER-TASKBLOCK. "Continue unaffected TaskBlocks when dependencies
 *    and safety allow" cannot be expressed by a job-level state, which is why
 *    everything below is scoped to task ids.
 */

/**
 * The six semantic impact classes.
 *
 * Listed in the canonical order for readability only. Do not sort by them, do
 * not compare them, and do not add a numeric rank — R4 and R5 differ in kind,
 * not in degree.
 */
export type ImpactClass =
  | "R0"  // confirmed as planned
  | "R1"  // minor operational variance
  | "R2"  // fulfillment/resource variance — the requirement still holds
  | "R3"  // requirement-impacting condition
  | "R4"  // safety or regulatory change
  | "R5"; // independent new work

/** What each class means and what it routes to. Reference, not a ranking. */
export const IMPACT_CLASSES: Readonly<Record<ImpactClass, { meaning: string; routesTo: string }>> =
  Object.freeze({
    R0: { meaning: "Confirmed as planned", routesTo: "execute the approved plan" },
    R1: { meaning: "Minor operational variance", routesTo: "adjust locally; no architecture change" },
    R2: { meaning: "Fulfillment/resource variance", routesTo: "L4/L5 — requirement valid, change provider or resource" },
    R3: { meaning: "Requirement-impacting condition", routesTo: "L2 — targeted reanalysis of affected nodes only" },
    R4: { meaning: "Safety/regulatory change", routesTo: "L3 — immediate affected-scope hold" },
    R5: { meaning: "Independent new work", routesTo: "L13 — CandidateFollowUp or branch, with consent" },
  });

export class RealityInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "RealityInvariantError";
  }
}

/**
 * An observation from the field. The executor reports what is true, and nothing
 * else: canon is explicit that "executor submits facts, not blame or self-priced
 * changes". There is no cost, no fault and no proposed scope on this type.
 */
export type FieldObservation = {
  readonly observationId: string;
  readonly taskId: string;
  readonly observedAt: string;
  readonly observedBy: string;
  readonly statement: string;
  /** Photos, measurements, readings. Immutable by reference. */
  readonly evidenceRefs: readonly string[];
};

/**
 * A fact that changed. The superseded value is kept, never overwritten —
 * P2 requires append-only provenance, and a dispute six weeks later needs to
 * see what was believed at planning time.
 */
export type ChangedFact = {
  readonly factKey: string;
  readonly supersededValue: string | null;
  readonly newValue: string;
  readonly source: "FIELD_OBSERVATION" | "CUSTOMER_FIELD_UPDATE";
  readonly evidenceRefs: readonly string[];
  readonly changedAt: string;
};

/**
 * Missing or contradictory information discovered in the field, as opposed to
 * at planning time. Low-latency by design: an executor is standing in someone's
 * kitchen waiting for it.
 */
export type FieldMSI = {
  readonly taskId: string;
  readonly question: string;
  readonly blocking: boolean;
};

export type ImpactClassification = {
  readonly taskId: string;
  readonly impact: ImpactClass;
  /** Why the classifier decided this. Feeds DecisionTrace; never optional. */
  readonly rationale: string;
  /** Set when the classification could not be made confidently. */
  readonly needsHumanReview: boolean;
};

/**
 * The port that answers open ruling OR-1.
 *
 * Whether an implementation is deterministic rules, a model with a deterministic
 * check, or a human queue is exactly the question the architecture has not
 * answered. This layer works with any of them and prefers none.
 */
export type ImpactClassifier = {
  classify(input: {
    readonly observation: FieldObservation;
    readonly changedFacts: readonly ChangedFact[];
    readonly plannedStatement: string;
  }): ImpactClassification;
};

export type RealityCase = {
  readonly realityCaseId: string;
  readonly workCaseId: string;
  readonly jobOrderId: string;
  readonly openedAt: string;
  readonly observations: readonly FieldObservation[];
  readonly changedFacts: readonly ChangedFact[];
  readonly fieldMSI: readonly FieldMSI[];
  readonly classifications: readonly ImpactClassification[];
  /** TaskBlocks held pending resolution. Everything else keeps running. */
  readonly heldTaskIds: readonly string[];
  readonly status: "OPEN" | "RECOVERING" | "RESOLVED" | "UNRECOVERABLE";
};

export function openRealityCase(input: {
  realityCaseId: string;
  workCaseId: string;
  jobOrderId: string;
  now: string;
}): RealityCase {
  for (const [k, v] of Object.entries(input)) {
    if (!String(v).trim()) throw new RealityInvariantError("IDENTITY", `${k} is required`);
  }
  return Object.freeze({
    realityCaseId: input.realityCaseId,
    workCaseId: input.workCaseId,
    jobOrderId: input.jobOrderId,
    openedAt: input.now,
    observations: Object.freeze([]),
    changedFacts: Object.freeze([]),
    fieldMSI: Object.freeze([]),
    classifications: Object.freeze([]),
    heldTaskIds: Object.freeze([]),
    status: "OPEN" as const,
  });
}

/**
 * Append an observation and whatever it changed, then classify.
 *
 * R4 holds the smallest safe affected scope immediately — before anything else
 * is decided, and without waiting for a recovery search. Every other class
 * leaves unaffected work running.
 */
export function recordObservation(input: {
  realityCase: RealityCase;
  observation: FieldObservation;
  changedFacts: readonly ChangedFact[];
  fieldMSI?: readonly FieldMSI[];
  plannedStatement: string;
  classifier: ImpactClassifier;
}): RealityCase {
  const { realityCase: rc, observation, changedFacts, classifier } = input;
  if (rc.status === "RESOLVED" || rc.status === "UNRECOVERABLE") {
    throw new RealityInvariantError("CASE_CLOSED", `cannot add observations to a ${rc.status} RealityCase`);
  }
  for (const f of changedFacts) {
    if (f.supersededValue === f.newValue) {
      throw new RealityInvariantError("NOT_A_CHANGE", `fact ${f.factKey} was recorded as changed but did not change`);
    }
  }
  const classification = classifier.classify({
    observation, changedFacts, plannedStatement: input.plannedStatement,
  });
  if (!classification.rationale.trim()) {
    throw new RealityInvariantError("RATIONALE_REQUIRED", "a classification without a rationale is not auditable");
  }
  if (classification.taskId !== observation.taskId) {
    throw new RealityInvariantError("TASK_MISMATCH", "classification names a different TaskBlock than the observation");
  }

  // Safety interrupt: hold the affected scope now, decide later.
  const held = classification.impact === "R4" && !rc.heldTaskIds.includes(observation.taskId)
    ? [...rc.heldTaskIds, observation.taskId]
    : rc.heldTaskIds;

  return Object.freeze({
    ...rc,
    observations: Object.freeze([...rc.observations, observation]),
    changedFacts: Object.freeze([...rc.changedFacts, ...changedFacts]),
    fieldMSI: Object.freeze([...rc.fieldMSI, ...(input.fieldMSI ?? [])]),
    classifications: Object.freeze([...rc.classifications, classification]),
    heldTaskIds: Object.freeze(held),
    status: "RECOVERING" as const,
  });
}

/**
 * TaskBlocks that may keep running.
 *
 * Canon: "continue unaffected TaskBlocks when dependencies and safety allow".
 * A task is affected if reality touched it, or if it depends on a task that
 * reality touched — an install cannot proceed on a prerequisite that is held.
 *
 * R5 is deliberately NOT affecting: independent new work does not stop the job
 * it was noticed during.
 */
export function unaffectedTaskIds(input: {
  realityCase: RealityCase;
  allTaskIds: readonly string[];
  /** taskId -> ids it depends on. */
  dependsOn: Readonly<Record<string, readonly string[]>>;
}): readonly string[] {
  const { realityCase: rc, allTaskIds, dependsOn } = input;
  const directly = new Set(
    rc.classifications.filter(c => c.impact !== "R0" && c.impact !== "R5").map(c => c.taskId),
  );
  for (const id of rc.heldTaskIds) directly.add(id);

  const blocked = new Set(directly);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of allTaskIds) {
      if (blocked.has(id)) continue;
      if ((dependsOn[id] ?? []).some(d => blocked.has(d))) { blocked.add(id); grew = true; }
    }
  }
  return Object.freeze(allTaskIds.filter(id => !blocked.has(id)));
}

/** Classes present on this case, in canonical listing order. Not a ranking. */
export function classesPresent(rc: RealityCase): readonly ImpactClass[] {
  const order: ImpactClass[] = ["R0", "R1", "R2", "R3", "R4", "R5"];
  const seen = new Set(rc.classifications.map(c => c.impact));
  return Object.freeze(order.filter(c => seen.has(c)));
}
