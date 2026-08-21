import {
  canTransitionLayer,
  domainLayer,
  type DomainLayerId,
  type LayerAuthority,
} from "./canonical-architecture";

/**
 * Platform control-plane state only. Domain truth stays in its owning stores.
 * This object answers "which owner may act next, and which artifact versions
 * are current?" It deliberately does not embed facts, providers, payments or
 * execution journals.
 */
export type JobOrderWorkflowState =
  | "REQUEST_RECEIVED"
  | "ARCHITECTING"
  | "REQUIREMENT_READY"
  | "GOVERNANCE_REVIEW"
  | "FULFILLING"
  | "RESOURCE_PLANNING"
  | "OFFER_READY"
  | "COMMITMENT_PENDING"
  | "COMMITTED"
  | "DISPATCH_READY"
  | "EXECUTING"
  | "RECONCILING"
  | "OUTCOME_RECORDED"
  | "SETTLING"
  | "CONTINUITY"
  | "CLOSED"
  | "EXCEPTION"
  | "HUMAN_REVIEW";

export type CurrentArtifactPointers = {
  requirementContractRef: string | null;
  fulfillmentPlanRef: string | null;
  executionSnapshotRef: string | null;
  outcomeRef: string | null;
};

export type WorkCaseControlState = {
  workCaseId: string;
  jobOrderId: string;
  stateVersion: number;
  state: JobOrderWorkflowState;
  currentLayerId: DomainLayerId;
  current: CurrentArtifactPointers;
  createdAt: string;
  updatedAt: string;
};

export class WorkCaseInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "WorkCaseInvariantError";
  }
}

export function createWorkCase(input: { workCaseId: string; jobOrderId: string; now: string }): WorkCaseControlState {
  if (!input.workCaseId.trim()) throw new WorkCaseInvariantError("WORK_CASE_ID", "workCaseId is required");
  if (!input.jobOrderId.trim()) throw new WorkCaseInvariantError("JOB_ORDER_ID", "jobOrderId is required");
  if (!input.now.trim()) throw new WorkCaseInvariantError("TIMESTAMP", "timestamp is required");
  return Object.freeze({
    workCaseId: input.workCaseId,
    jobOrderId: input.jobOrderId,
    stateVersion: 1,
    state: "REQUEST_RECEIVED" as const,
    currentLayerId: "L01" as const,
    current: Object.freeze({ requirementContractRef: null, fulfillmentPlanRef: null, executionSnapshotRef: null, outcomeRef: null }),
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function beginArchitecting(workCase: WorkCaseControlState, input: { expectedVersion: number; now: string }): WorkCaseControlState {
  assertExpectedVersion(workCase, input.expectedVersion);
  if (
    workCase.state !== "REQUEST_RECEIVED" &&
    workCase.state !== "ARCHITECTING" &&
    workCase.state !== "REQUIREMENT_READY"
  ) {
    throw new WorkCaseInvariantError("INVALID_TRANSITION", `cannot enter ARCHITECTING from ${workCase.state}`);
  }

  const next = advance(workCase, "ARCHITECTING", "L02", input.now);

  // Reanalysis invalidates the pointer used to authorize fulfillment. The
  // published Requirement Contract remains immutable in its own store and can
  // be superseded by a later ready analysis, but no stale contract remains
  // current on the WorkCase while requirements are being reconsidered.
  if (workCase.state === "REQUIREMENT_READY") {
    return Object.freeze({
      ...next,
      current: Object.freeze({
        ...next.current,
        requirementContractRef: null,
      }),
    });
  }

  return next;
}

export function markRequirementReady(workCase: WorkCaseControlState, input: { expectedVersion: number; requirementContractRef: string; now: string }): WorkCaseControlState {
  assertExpectedVersion(workCase, input.expectedVersion);
  if (workCase.state !== "ARCHITECTING") throw new WorkCaseInvariantError("INVALID_TRANSITION", `cannot enter REQUIREMENT_READY from ${workCase.state}`);
  if (!/^.+@\d+$/.test(input.requirementContractRef)) throw new WorkCaseInvariantError("REQUIREMENT_REF", "a version-bound Requirement Contract reference is required");
  return Object.freeze({
    ...advance(workCase, "REQUIREMENT_READY", "L02", input.now),
    current: Object.freeze({ ...workCase.current, requirementContractRef: input.requirementContractRef }),
  });
}

export function advanceWorkCaseLayer(
  workCase: WorkCaseControlState,
  input: {
    expectedVersion: number;
    targetLayerId: DomainLayerId;
    gateArtifactRef: string;
    actorRole: LayerAuthority;
    now: string;
  },
): WorkCaseControlState {
  assertExpectedVersion(workCase, input.expectedVersion);

  if (!canTransitionLayer(workCase.currentLayerId, input.targetLayerId)) {
    throw new WorkCaseInvariantError(
      "INVALID_LAYER_TRANSITION",
      `cannot move from ${workCase.currentLayerId} to ${input.targetLayerId}`,
    );
  }

  if (!/^.+@\d+$/.test(input.gateArtifactRef)) {
    throw new WorkCaseInvariantError(
      "GATE_ARTIFACT_REQUIRED",
      "a version-bound gate artifact reference is required",
    );
  }

  const target = domainLayer(input.targetLayerId);
  if (target.decisionOwner !== input.actorRole) {
    throw new WorkCaseInvariantError(
      "LAYER_AUTHORITY",
      `${input.actorRole} cannot authorize ${input.targetLayerId}; ${target.decisionOwner} owns that decision`,
    );
  }

  if (
    workCase.currentLayerId === "L02" &&
    input.targetLayerId === "L03" &&
    workCase.current.requirementContractRef !== input.gateArtifactRef
  ) {
    throw new WorkCaseInvariantError(
      "REQUIREMENT_REQUIRED",
      "L03 must consume the current published Requirement Contract",
    );
  }

  const next = advance(
    workCase,
    workflowStateForLayer(input.targetLayerId),
    input.targetLayerId,
    input.now,
  );
  return Object.freeze({
    ...next,
    current: currentPointersAfterGate(
      workCase,
      input.targetLayerId,
      input.gateArtifactRef,
    ),
  });
}

export function beginGovernanceReview(
  workCase: WorkCaseControlState,
  input: { expectedVersion: number; requirementContractRef: string; now: string },
): WorkCaseControlState {
  if (workCase.state !== "REQUIREMENT_READY" || !workCase.current.requirementContractRef) {
    throw new WorkCaseInvariantError(
      "REQUIREMENT_REQUIRED",
      "governance cannot start before a published Requirement Contract is current",
    );
  }
  return advanceWorkCaseLayer(workCase, {
    expectedVersion: input.expectedVersion,
    targetLayerId: "L03",
    gateArtifactRef: input.requirementContractRef,
    actorRole: "TRUST_SAFETY_RULES",
    now: input.now,
  });
}

export function beginFulfilling(
  workCase: WorkCaseControlState,
  input: { expectedVersion: number; ruleDecisionRef: string; now: string },
): WorkCaseControlState {
  if (workCase.currentLayerId !== "L03") {
    throw new WorkCaseInvariantError(
      "GOVERNANCE_REQUIRED",
      "fulfillment cannot start before the L03 Rule Decision",
    );
  }
  return advanceWorkCaseLayer(workCase, {
    expectedVersion: input.expectedVersion,
    targetLayerId: "L04",
    gateArtifactRef: input.ruleDecisionRef,
    actorRole: "FULFILLMENT_TEAM",
    now: input.now,
  });
}

function workflowStateForLayer(layerId: DomainLayerId): JobOrderWorkflowState {
  const stateByLayer: Readonly<Record<DomainLayerId, JobOrderWorkflowState>> = {
    L01: "REQUEST_RECEIVED",
    L02: "ARCHITECTING",
    L03: "GOVERNANCE_REVIEW",
    L04: "FULFILLING",
    L05: "RESOURCE_PLANNING",
    L06: "OFFER_READY",
    L07: "COMMITMENT_PENDING",
    L08: "DISPATCH_READY",
    L09: "EXECUTING",
    L10: "RECONCILING",
    L11: "OUTCOME_RECORDED",
    L12: "SETTLING",
    L13: "CONTINUITY",
  };
  return stateByLayer[layerId];
}

function currentPointersAfterGate(
  workCase: WorkCaseControlState,
  targetLayerId: DomainLayerId,
  gateArtifactRef: string,
): Readonly<CurrentArtifactPointers> {
  const targetIndex = Number(targetLayerId.slice(1));
  const current: CurrentArtifactPointers = {
    requirementContractRef: targetLayerId === "L02" ? null : workCase.current.requirementContractRef,
    fulfillmentPlanRef: targetIndex <= 4 ? null : workCase.current.fulfillmentPlanRef,
    executionSnapshotRef: targetIndex <= 9 ? null : workCase.current.executionSnapshotRef,
    outcomeRef: targetIndex <= 11 ? null : workCase.current.outcomeRef,
  };

  // These critical outputs are promoted to current pointers when their owner
  // releases the next layer. Other artifacts remain in the append-only event
  // stream and in their owning domain stores.
  if (workCase.currentLayerId === "L04" && targetLayerId === "L05") {
    current.fulfillmentPlanRef = gateArtifactRef;
  }
  if (workCase.currentLayerId === "L09" && targetLayerId === "L10") {
    current.executionSnapshotRef = gateArtifactRef;
  }
  if (workCase.currentLayerId === "L11" && targetLayerId === "L12") {
    current.outcomeRef = gateArtifactRef;
  }

  return Object.freeze(current);
}

function advance(workCase: WorkCaseControlState, state: JobOrderWorkflowState, currentLayerId: DomainLayerId, now: string): WorkCaseControlState {
  if (!now.trim()) throw new WorkCaseInvariantError("TIMESTAMP", "timestamp is required");
  return Object.freeze({ ...workCase, state, currentLayerId, stateVersion: workCase.stateVersion + 1, updatedAt: now, current: Object.freeze({ ...workCase.current }) });
}

function assertExpectedVersion(workCase: WorkCaseControlState, expectedVersion: number) {
  if (workCase.stateVersion !== expectedVersion) {
    throw new WorkCaseInvariantError("STALE_COMMAND", `expected WorkCase state v${expectedVersion}, current is v${workCase.stateVersion}`);
  }
}
