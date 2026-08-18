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
  | "FULFILLING"
  | "COMMITMENT_PENDING"
  | "COMMITTED"
  | "EXECUTING"
  | "RECONCILING"
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
    current: Object.freeze({ requirementContractRef: null, fulfillmentPlanRef: null, executionSnapshotRef: null, outcomeRef: null }),
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function beginArchitecting(workCase: WorkCaseControlState, input: { expectedVersion: number; now: string }): WorkCaseControlState {
  assertExpectedVersion(workCase, input.expectedVersion);
  if (workCase.state !== "REQUEST_RECEIVED" && workCase.state !== "ARCHITECTING") {
    throw new WorkCaseInvariantError("INVALID_TRANSITION", `cannot enter ARCHITECTING from ${workCase.state}`);
  }
  return advance(workCase, "ARCHITECTING", input.now);
}

export function markRequirementReady(workCase: WorkCaseControlState, input: { expectedVersion: number; requirementContractRef: string; now: string }): WorkCaseControlState {
  assertExpectedVersion(workCase, input.expectedVersion);
  if (workCase.state !== "ARCHITECTING") throw new WorkCaseInvariantError("INVALID_TRANSITION", `cannot enter REQUIREMENT_READY from ${workCase.state}`);
  if (!/^.+@\d+$/.test(input.requirementContractRef)) throw new WorkCaseInvariantError("REQUIREMENT_REF", "a version-bound Requirement Contract reference is required");
  return Object.freeze({
    ...advance(workCase, "REQUIREMENT_READY", input.now),
    current: Object.freeze({ ...workCase.current, requirementContractRef: input.requirementContractRef }),
  });
}

export function beginFulfilling(workCase: WorkCaseControlState, input: { expectedVersion: number; now: string }): WorkCaseControlState {
  assertExpectedVersion(workCase, input.expectedVersion);
  if (workCase.state !== "REQUIREMENT_READY" || !workCase.current.requirementContractRef) {
    throw new WorkCaseInvariantError("REQUIREMENT_REQUIRED", "fulfillment cannot start before a published Requirement Contract is current");
  }
  return advance(workCase, "FULFILLING", input.now);
}

function advance(workCase: WorkCaseControlState, state: JobOrderWorkflowState, now: string): WorkCaseControlState {
  if (!now.trim()) throw new WorkCaseInvariantError("TIMESTAMP", "timestamp is required");
  return Object.freeze({ ...workCase, state, stateVersion: workCase.stateVersion + 1, updatedAt: now, current: Object.freeze({ ...workCase.current }) });
}

function assertExpectedVersion(workCase: WorkCaseControlState, expectedVersion: number) {
  if (workCase.stateVersion !== expectedVersion) {
    throw new WorkCaseInvariantError("STALE_COMMAND", `expected WorkCase state v${expectedVersion}, current is v${workCase.stateVersion}`);
  }
}
