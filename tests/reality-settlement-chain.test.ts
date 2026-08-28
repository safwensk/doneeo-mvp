/**
 * L09A and L09B wired, and then the whole chain in one go.
 *
 * The last test in this file is the one that justifies the wiring pass: a job
 * is committed, disrupted on site, recovered where possible, cancelled for the
 * part that cannot be, and settled — through the real services, with the real
 * pilot policy, in the order the architecture says.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { RealityService, RealityServiceError } from "../lib/application/reality-service";
import { SettlementService } from "../lib/application/settlement-service";
import { CommitmentService } from "../lib/application/commitment-service";
import type {
  RealityStore, StoredRealityCase, RealityEvent,
} from "../lib/application/reality-store";
import type {
  CommitmentStore, StoredCommitment, CommitmentEvent,
} from "../lib/application/commitment-store";
import type { StoredCommand } from "../lib/application/requirement-contract-store";
import type { ResponsibilityAssessment } from "../lib/layers/l09b/responsibility";
import type { AdjustmentInstruction } from "../lib/layers/l09b/allocation";
import type { RecoverySearch, RecoveryOptionKind } from "../lib/layers/l09a/recovery";
import type { ChangedFact, FieldObservation } from "../lib/layers/l09a/reality";
import type { CapacityReservation } from "../lib/layers/l7/commitment";
import { MONTREAL_PILOT } from "../lib/policy/montreal-pilot";

const START = "2026-09-10T14:00:00.000Z";
const before = (m: number) => new Date(Date.parse(START) - m * 60_000).toISOString();
const ON_SITE = "2026-09-10T14:20:00.000Z";

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

class MemoryRealityStore implements RealityStore {
  cases = new Map<string, StoredRealityCase>();
  commands = new Map<string, StoredCommand>();
  events: RealityEvent[] = [];
  observations: { observationId: string; statement: string }[] = [];
  facts: ChangedFact[] = [];
  classifications: { impact: string; rationale: string; classifierName: string }[] = [];
  settlements = new Map<string, { assessment: ResponsibilityAssessment; instruction: AdjustmentInstruction | null }>();

  async get(id: string) { return this.cases.get(id) ?? null; }
  async findOpenByJobOrder(jobOrderId: string) {
    for (const c of this.cases.values()) {
      if (c.realityCase.jobOrderId === jobOrderId &&
          (c.realityCase.status === "OPEN" || c.realityCase.status === "RECOVERING")) return c;
    }
    return null;
  }
  async getCommand(k: string) { return this.commands.get(k) ?? null; }
  async openAtomic(i: { stored: StoredRealityCase; command: StoredCommand; event: RealityEvent }) {
    this.cases.set(i.stored.realityCase.realityCaseId, i.stored);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  private guard(previous: StoredRealityCase, next: StoredRealityCase) {
    const live = this.cases.get(next.realityCase.realityCaseId);
    if (!live || live.stateVersion !== previous.stateVersion) {
      throw new Error(`concurrent modification of ${next.realityCase.realityCaseId}`);
    }
  }
  async appendObservationAtomic(i: Parameters<RealityStore["appendObservationAtomic"]>[0]) {
    this.guard(i.previous, i.next);
    this.cases.set(i.next.realityCase.realityCaseId, i.next);
    this.observations.push({ observationId: i.observation.observationId, statement: i.observation.statement });
    this.facts.push(...i.changedFacts);
    this.classifications.push({
      impact: i.classification.impact, rationale: i.classification.rationale, classifierName: i.classifierName,
    });
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async saveRecoveryAtomic(i: Parameters<RealityStore["saveRecoveryAtomic"]>[0]) {
    this.guard(i.previous, i.next);
    this.cases.set(i.next.realityCase.realityCaseId, i.next);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async saveSettlementAtomic(i: Parameters<RealityStore["saveSettlementAtomic"]>[0]) {
    this.settlements.set(i.assessmentId, { assessment: i.assessment, instruction: i.instruction });
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async getAssessment(id: string) { return this.settlements.get(id) ?? null; }
}

class MemoryCommitmentStore implements CommitmentStore {
  commitments = new Map<string, StoredCommitment>();
  commands = new Map<string, StoredCommand>();
  events: CommitmentEvent[] = [];
  async get(id: string) { return this.commitments.get(id) ?? null; }
  async getCommand(k: string) { return this.commands.get(k) ?? null; }
  async acceptedAssignments() {
    return [
      { executorId: "ex-lead", role: "lead", isLead: true },
      { executorId: "ex-helper", role: "helper", isLead: false },
    ];
  }
  async reservations(id: string): Promise<readonly CapacityReservation[]> {
    return this.commitments.get(id)?.state.reservations ?? [];
  }
  async openAtomic(i: { commitment: StoredCommitment; command: StoredCommand; event: CommitmentEvent }) {
    this.commitments.set(i.commitment.state.jobOrderId, i.commitment);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async saveAtomic(i: { previous: StoredCommitment; next: StoredCommitment; command: StoredCommand; event: CommitmentEvent }) {
    const live = this.commitments.get(i.next.state.jobOrderId);
    if (!live || live.stateVersion !== i.previous.stateVersion) throw new Error("concurrent modification");
    this.commitments.set(i.next.state.jobOrderId, i.next);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
}

function services() {
  const realityStore = new MemoryRealityStore();
  const commitmentStore = new MemoryCommitmentStore();
  return {
    realityStore, commitmentStore,
    reality: new RealityService(realityStore, { name: MONTREAL_PILOT.name, classifier: MONTREAL_PILOT.classifier }),
    settlement: new SettlementService(realityStore, { name: MONTREAL_PILOT.name, review: MONTREAL_PILOT.review }),
    commitment: new CommitmentService(commitmentStore, { name: MONTREAL_PILOT.name, commitment: MONTREAL_PILOT.commitment }),
  };
}

const obs = (over: Partial<FieldObservation> = {}): FieldObservation => ({
  observationId: "OB-1", taskId: "T-2", observedAt: ON_SITE, observedBy: "ex-lead",
  statement: "wall cavity is not what the plan assumed", evidenceRefs: ["photo-1"], ...over,
});
const fact = (factKey: string): ChangedFact => ({
  factKey, supersededValue: "assumed", newValue: "actual",
  source: "FIELD_OBSERVATION", evidenceRefs: ["photo-1"], changedAt: ON_SITE,
});

/** Offers every option as non-viable except the ones named. */
function searchOffering(viable: readonly RecoveryOptionKind[]): RecoverySearch {
  return {
    evaluate: ({ kind, affectedTaskIds }) => ({
      kind, taskIds: affectedTaskIds,
      viable: viable.includes(kind),
      reason: viable.includes(kind) ? `${kind} is available` : `${kind} not available`,
      changesRequirement: kind === "TARGETED_REARCHITECTURE" || kind === "FULL_REPLAN",
      needsCustomerApproval: kind === "FULL_REPLAN" || kind === "CANCEL_AFFECTED_SCOPE",
    }),
  };
}

const openCase = async (s: ReturnType<typeof services>) => s.reality.open({
  commandKey: "c-open", realityCaseId: "RC-1", workCaseId: "WC-1",
  jobOrderId: "JOB-1", correlationId: "corr-1", now: ON_SITE,
});

// ---------------------------------------------------------------------------
// L09A wiring
// ---------------------------------------------------------------------------

test("a second disruption joins the open case rather than starting another", async () => {
  const s = services();
  await openCase(s);
  await assert.rejects(() => s.reality.open({
    commandKey: "c-open-2", realityCaseId: "RC-2", workCaseId: "WC-1",
    jobOrderId: "JOB-1", correlationId: "corr-1", now: ON_SITE,
  }), (e: unknown) => e instanceof RealityServiceError && e.code === "CASE_ALREADY_OPEN");
});

test("a safety fact holds scope before anything else is decided", async () => {
  const s = services();
  const { stored } = await openCase(s);
  const { stored: after, heldNow } = await s.reality.observe({
    commandKey: "c-obs", realityCaseId: "RC-1", expectedVersion: stored.stateVersion,
    observation: obs(), changedFacts: [fact("safety.asbestos_suspected")],
    plannedStatement: "open the wall", correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(heldNow, true);
  assert.deepEqual(after.realityCase.heldTaskIds, ["T-2"]);
  assert.equal(s.realityStore.events.at(-1)!.eventType, "ScopeHeld",
    "the hold is visible as its own event, not buried in an observation");
});

test("provenance is appended, never overwritten", async () => {
  const s = services();
  const { stored } = await openCase(s);
  await s.reality.observe({
    commandKey: "c-obs", realityCaseId: "RC-1", expectedVersion: stored.stateVersion,
    observation: obs(), changedFacts: [fact("condition.cavity_depth")],
    plannedStatement: "open the wall", correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(s.realityStore.facts.length, 1);
  assert.equal(s.realityStore.facts[0]!.supersededValue, "assumed",
    "what was believed at planning time must survive");
  assert.equal(s.realityStore.classifications[0]!.classifierName, "montreal-pilot",
    "which classifier decided is recorded; OR-1 is open and the answer may change");
});

test("recovery prefers preserving committed work over replanning", async () => {
  const s = services();
  const { stored } = await openCase(s);
  const o = await s.reality.observe({
    commandKey: "c-obs", realityCaseId: "RC-1", expectedVersion: stored.stateVersion,
    observation: obs(), changedFacts: [fact("equipment.lift_unavailable")],
    plannedStatement: "open the wall", correlationId: "corr-1", now: ON_SITE,
  });
  const { decision } = await s.reality.recover({
    commandKey: "c-rec", realityCaseId: "RC-1", expectedVersion: o.stored.stateVersion,
    allTaskIds: ["T-1", "T-2", "T-3"], dependsOn: {},
    search: searchOffering(["REDISTRIBUTE_TEAM", "FULL_REPLAN"]),
    correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(decision.selected?.kind, "REDISTRIBUTE_TEAM",
    "a viable preserving option must win over a viable full replan");
  assert.ok(decision.continuingTaskIds.includes("T-1"), "unaffected work keeps running");
});

test("no viable option marks the case unrecoverable and routes to L7", async () => {
  const s = services();
  const { stored } = await openCase(s);
  const o = await s.reality.observe({
    commandKey: "c-obs", realityCaseId: "RC-1", expectedVersion: stored.stateVersion,
    observation: obs(), changedFacts: [fact("condition.cavity_depth")],
    plannedStatement: "open the wall", correlationId: "corr-1", now: ON_SITE,
  });
  const { decision, stored: after } = await s.reality.recover({
    commandKey: "c-rec", realityCaseId: "RC-1", expectedVersion: o.stored.stateVersion,
    allTaskIds: ["T-2"], dependsOn: {}, search: searchOffering([]),
    correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(decision.unrecoverable, true);
  assert.equal(after.realityCase.status, "UNRECOVERABLE");
  assert.ok(decision.routeTo.includes("L7_RESCHEDULE_OR_CANCEL"));
  assert.equal(s.realityStore.events.at(-1)!.eventType, "CaseUnrecoverable");
});

// ---------------------------------------------------------------------------
// L09B wiring
// ---------------------------------------------------------------------------

const CUSTOMER_AT_FAULT = {
  materialFact: true, doneeoAskedOrDisclosedImportance: true, customerCouldReasonablyKnow: true,
  inaccurateOrOmitted: true, causalLink: true,
  doneeoShouldHaveAsked: false, doneeoIgnoredContradictoryEvidence: false,
};
const PROVIDER_PERFORMED = {
  metObligations: true, preparedAsAgreed: true, executedAsAgreed: true, evidenceRefs: ["photo-1"],
};
const DONEEO_CLEAN = {
  planningError: false, systemOrMarketplaceFailure: false, partnerFailureUnderDoneeoContract: false,
};
const COSTS = [
  { kind: "MOBILIZATION" as const, role: "lead", minutes: 45 },
  { kind: "NET_LOST_CAPACITY" as const, role: "helper", minutes: 240 },
];

test("a case sent to review is stored without an allocation", async () => {
  const s = services();
  const r = await s.settlement.settle({
    commandKey: "c-set", assessmentId: "AS-1", jobOrderId: "JOB-1", realityCaseId: "RC-1",
    cause: "MIXED", customerTest: CUSTOMER_AT_FAULT, providerTest: PROVIDER_PERFORMED,
    doneeoTest: DONEEO_CLEAN, disputed: false, evidenceRefs: ["photo-1"],
    eligibleCosts: COSTS, correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(r.assessment.requiresReview, true);
  assert.equal(r.instruction, null, "a reviewed case must carry no pre-computed allocation");
  assert.equal(s.realityStore.settlements.get("AS-1")!.instruction, null);
});

test("a clear case allocates, and the three totals stay independent", async () => {
  const s = services();
  const r = await s.settlement.settle({
    commandKey: "c-set", assessmentId: "AS-1", jobOrderId: "JOB-1", realityCaseId: "RC-1",
    cause: "CUSTOMER_INACCURATE_OR_OMITTED_FACT", customerTest: CUSTOMER_AT_FAULT,
    providerTest: PROVIDER_PERFORMED, doneeoTest: DONEEO_CLEAN, disputed: false,
    evidenceRefs: ["photo-1"], eligibleCosts: COSTS, correlationId: "corr-1", now: ON_SITE,
  });
  assert.ok(r.instruction);
  assert.equal(r.instruction!.customerRealityAdjustment.minutes, 285);
  assert.equal(r.instruction!.chargesUnperformedWork, false);

  // Protection is answerable on its own — it follows performance, not fault.
  const ppp = s.settlement.providerProtection({ assessment: r.assessment, eligibleCosts: COSTS });
  assert.equal(ppp.minutes, 285);
  assert.deepEqual(ppp.byRole, { lead: 45, helper: 240 });
});

test("a Doneeo planning error never becomes a customer charge", async () => {
  const s = services();
  const r = await s.settlement.settle({
    commandKey: "c-set", assessmentId: "AS-1", jobOrderId: "JOB-1", realityCaseId: "RC-1",
    cause: "DONEEO_PLANNING_ERROR",
    // A pure planning error: the customer told us nothing wrong.
    customerTest: { ...CUSTOMER_AT_FAULT, inaccurateOrOmitted: false },
    providerTest: PROVIDER_PERFORMED, doneeoTest: { ...DONEEO_CLEAN, planningError: true },
    disputed: false, evidenceRefs: ["photo-1"], eligibleCosts: COSTS,
    correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(r.assessment.requiresReview, false);
  assert.equal(r.instruction!.customerRealityAdjustment.minutes, 0);
  assert.equal(r.instruction!.doneeoAbsorption.minutes, 285);
});

test("customer fault AND a Doneeo error together go to a person, not to a rule", async () => {
  // Both tests independently establish. The layer permits that — they are not
  // shares of one whole — but the pilot declines to allocate it automatically
  // while the rules have not been exercised against real disputes.
  const s = services();
  const r = await s.settlement.settle({
    commandKey: "c-set", assessmentId: "AS-1", jobOrderId: "JOB-1", realityCaseId: "RC-1",
    cause: "DONEEO_PLANNING_ERROR", customerTest: CUSTOMER_AT_FAULT,
    providerTest: PROVIDER_PERFORMED, doneeoTest: { ...DONEEO_CLEAN, planningError: true },
    disputed: false, evidenceRefs: ["photo-1"], eligibleCosts: COSTS,
    correlationId: "corr-1", now: ON_SITE,
  });
  assert.equal(r.assessment.customer.established, true);
  assert.equal(r.assessment.doneeo.established, true);
  assert.equal(r.assessment.requiresReview, true);
  assert.equal(r.instruction, null, "no allocation is computed for a case a person must decide");
});

test("nothing anywhere in a stored settlement looks like money", async () => {
  const s = services();
  await s.settlement.settle({
    commandKey: "c-set", assessmentId: "AS-1", jobOrderId: "JOB-1", realityCaseId: "RC-1",
    cause: "CUSTOMER_INACCURATE_OR_OMITTED_FACT", customerTest: CUSTOMER_AT_FAULT,
    providerTest: PROVIDER_PERFORMED, doneeoTest: DONEEO_CLEAN, disputed: false,
    evidenceRefs: ["photo-1"], eligibleCosts: COSTS, correlationId: "corr-1", now: ON_SITE,
  });
  const json = JSON.stringify([...s.realityStore.settlements.values()]).toLowerCase();
  for (const bad of ["price", "currency", "cad", "amount", "\"fee\""]) {
    assert.ok(!json.includes(bad), `L09B stored something priced: "${bad}" — L6 prices, L12 posts`);
  }
});

// ---------------------------------------------------------------------------
// The whole chain
// ---------------------------------------------------------------------------

test("END TO END · commit → disrupt → recover → cancel → settle", async () => {
  const s = services();

  // 1. L7 — two people, four hours each, committed the day before.
  const held = await s.commitment.holdCapacityForJob({
    commandKey: "e-hold", jobOrderId: "JOB-1", workCaseId: "WC-1", startsAt: START,
    minutesPerRole: 240, correlationId: "e", now: before(30 * 60),
  });
  assert.equal(s.commitment.stageOf(held.commitment, before(30 * 60)), "COMMITMENT_BEGINS");

  // 2. The lead travels, then starts. The ladder climbs on facts.
  const prepped = await s.commitment.recordPreparation({
    commandKey: "e-prep", jobOrderId: "JOB-1", expectedVersion: held.commitment.stateVersion,
    record: { reservationId: "RES-JOB-1-ex-lead", preparationMinutes: 0, mobilizationMinutes: 45, externalCostRefs: [] },
    correlationId: "e", now: before(60),
  });
  assert.equal(prepped.stage, "MOBILIZED");
  const started = await s.commitment.startWork({
    commandKey: "e-start", jobOrderId: "JOB-1", expectedVersion: prepped.commitment.stateVersion,
    correlationId: "e", now: START,
  });
  assert.equal(started.stage, "WORK_STARTED");

  // 3. L09A — on site, the wall is not what the plan assumed.
  const opened = await s.reality.open({
    commandKey: "e-open", realityCaseId: "RC-1", workCaseId: "WC-1",
    jobOrderId: "JOB-1", correlationId: "e", now: ON_SITE,
  });
  const observed = await s.reality.observe({
    commandKey: "e-obs", realityCaseId: "RC-1", expectedVersion: opened.stored.stateVersion,
    observation: obs(), changedFacts: [fact("condition.cavity_depth")],
    plannedStatement: "open the wall and run conduit", correlationId: "e", now: ON_SITE,
  });
  assert.equal(observed.stored.realityCase.classifications[0]!.impact, "R3",
    "a changed condition changes what successful work requires");

  // 4. Recovery finds nothing safe. The case becomes L7's problem.
  const recovered = await s.reality.recover({
    commandKey: "e-rec", realityCaseId: "RC-1", expectedVersion: observed.stored.stateVersion,
    allTaskIds: ["T-1", "T-2"], dependsOn: { "T-2": ["T-1"] },
    search: searchOffering([]), correlationId: "e", now: ON_SITE,
  });
  assert.equal(recovered.decision.unrecoverable, true);
  assert.ok(recovered.decision.routeTo.includes("L7_RESCHEDULE_OR_CANCEL"));

  // 5. L7 cancels. The lead's remaining slot is rebooked; the helper's is not.
  const cancelled = await s.commitment.cancel({
    commandKey: "e-cancel", jobOrderId: "JOB-1", expectedVersion: started.commitment.stateVersion,
    request: {
      requestId: "CR-1",
      jobOrderId: "JOB-1", cause: "FIELD_REALITY_UNRECOVERABLE",
      requestedAt: ON_SITE, requestedBy: "SYSTEM", disputed: false,
    },
    ports: {
      rescheduleOptions: () => [],
      attemptBackfill: () => [{ reservationId: "RES-JOB-1-ex-lead", minutes: 180 }],
    },
    correlationId: "e", now: ON_SITE,
  });
  assert.deepEqual(cancelled.outcome.steps.slice(0, 4),
    ["FREEZE", "SNAPSHOT", "RESCHEDULE_TEST", "CAPACITY_RECOVERY"]);
  assert.equal(cancelled.outcome.snapshot.stage, "WORK_STARTED",
    "cancellation from any stage — canon's Any -> S5");
  assert.deepEqual(cancelled.outcome.recovery.netLostByRole, { lead: 60, helper: 240 },
    "backfill ran before loss was measured");

  // 6. L09B settles what L7 measured. A hidden condition is nobody's fault,
  //    so the customer bears nothing and the provider is still made whole.
  const settled = await s.settlement.settle({
    commandKey: "e-settle", assessmentId: "AS-1", jobOrderId: "JOB-1", realityCaseId: "RC-1",
    cause: "HIDDEN_CONDITION",
    customerTest: { ...CUSTOMER_AT_FAULT, materialFact: false },
    providerTest: PROVIDER_PERFORMED, doneeoTest: DONEEO_CLEAN, disputed: false,
    evidenceRefs: ["photo-1"],
    eligibleCosts: cancelled.outcome.instruction.eligibleCosts,
    correlationId: "e", now: ON_SITE,
  });
  assert.ok(settled.instruction, "a clear no-fault case settles without review");
  assert.equal(settled.instruction!.customerRealityAdjustment.minutes, 0,
    "a hidden condition alone never creates customer liability");
  assert.ok(settled.instruction!.doneeoAbsorption.minutes > 0, "the platform carries it");
  assert.equal(settled.instruction!.chargesUnperformedWork, false);

  // The provider is protected for what they actually did, regardless of cause.
  const ppp = s.settlement.providerProtection({
    assessment: settled.assessment,
    eligibleCosts: cancelled.outcome.instruction.eligibleCosts,
  });
  assert.ok(ppp.minutes > 0, "protection follows performance, not fault");

  // 7. The trail. Every step left a record, in order.
  assert.deepEqual(s.commitmentStore.events.map(e => e.eventType),
    ["CapacityHeld", "MobilizationStarted", "WorkStarted", "CancellationRequested"]);
  assert.deepEqual(s.realityStore.events.map(e => e.eventType),
    ["RealityCaseOpened", "ObservationRecorded", "CaseUnrecoverable", "AdjustmentIssued"]);
});
