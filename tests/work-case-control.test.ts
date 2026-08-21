import test from "node:test";
import assert from "node:assert/strict";
import { advanceWorkCaseLayer, beginArchitecting, beginFulfilling, beginGovernanceReview, createWorkCase, markRequirementReady, WorkCaseInvariantError } from "../lib/work-case";
import { reconcileTaskIdentities } from "../lib/intelligence-task-identity";

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T10:01:00.000Z";
const T3 = "2026-08-18T10:02:00.000Z";
const T4 = "2026-08-18T10:03:00.000Z";
const T5 = "2026-08-18T10:04:00.000Z";

test("control plane advances only through guarded authoritative states", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const architecting = beginArchitecting(created, { expectedVersion: 1, now: T2 });
  const ready = markRequirementReady(architecting, { expectedVersion: 2, requirementContractRef: "RC-1@1", now: T3 });
  const governance = beginGovernanceReview(ready, { expectedVersion: 3, requirementContractRef: "RC-1@1", now: T4 });
  const fulfilling = beginFulfilling(governance, { expectedVersion: 4, ruleDecisionRef: "RULE-1@1", now: T5 });
  assert.equal(created.state, "REQUEST_RECEIVED");
  assert.equal(created.currentLayerId, "L01");
  assert.equal(architecting.state, "ARCHITECTING");
  assert.equal(architecting.currentLayerId, "L02");
  assert.equal(ready.state, "REQUIREMENT_READY");
  assert.equal(ready.current.requirementContractRef, "RC-1@1");
  assert.equal(governance.currentLayerId, "L03");
  assert.equal(fulfilling.state, "FULFILLING");
  assert.equal(fulfilling.currentLayerId, "L04");
  assert.equal(fulfilling.stateVersion, 5);
});

test("stale expected-version command is rejected instead of silently overwriting state", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  assert.throws(() => beginArchitecting(created, { expectedVersion: 7, now: T2 }), (error: WorkCaseInvariantError) => error.invariant === "STALE_COMMAND");
});

test("fulfillment cannot start without a published Requirement Contract pointer", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const architecting = beginArchitecting(created, { expectedVersion: 1, now: T2 });
  assert.throws(() => beginFulfilling(architecting, { expectedVersion: 2, ruleDecisionRef: "RULE-1@1", now: T3 }), (error: WorkCaseInvariantError) => error.invariant === "GOVERNANCE_REQUIRED");
});

test("layer authority and recovery loops are explicit", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const architecting = beginArchitecting(created, { expectedVersion: 1, now: T2 });
  const ready = markRequirementReady(architecting, { expectedVersion: 2, requirementContractRef: "RC-1@1", now: T3 });
  assert.throws(
    () => advanceWorkCaseLayer(ready, { expectedVersion: 3, targetLayerId: "L03", gateArtifactRef: "RC-1@1", actorRole: "FULFILLMENT_TEAM", now: T4 }),
    (error: WorkCaseInvariantError) => error.invariant === "LAYER_AUTHORITY",
  );
});

test("critical pointers follow their owning artifacts and recovery clears stale downstream truth", () => {
  const received = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const planned = beginArchitecting(received, { expectedVersion: 1, now: T2 });
  const ready = markRequirementReady(planned, { expectedVersion: 2, requirementContractRef: "RC-1@1", now: T3 });
  const governed = beginGovernanceReview(ready, { expectedVersion: 3, requirementContractRef: "RC-1@1", now: T4 });
  const fulfilling = beginFulfilling(governed, { expectedVersion: 4, ruleDecisionRef: "RULE-1@1", now: T5 });
  const resources = advanceWorkCaseLayer(fulfilling, { expectedVersion: 5, targetLayerId: "L05", gateArtifactRef: "FP-1@1", actorRole: "RESOURCES_LOGISTICS", now: T5 });
  assert.equal(resources.current.fulfillmentPlanRef, "FP-1@1");
  const offer = advanceWorkCaseLayer(resources, { expectedVersion: 6, targetLayerId: "L06", gateArtifactRef: "RP-1@1", actorRole: "COMMERCIAL_OFFER", now: T5 });
  const committed = advanceWorkCaseLayer(offer, { expectedVersion: 7, targetLayerId: "L07", gateArtifactRef: "OFFER-1@1", actorRole: "COMMITMENT_CAPACITY", now: T5 });
  const dispatch = advanceWorkCaseLayer(committed, { expectedVersion: 8, targetLayerId: "L08", gateArtifactRef: "COMMIT-1@1", actorRole: "ROUTING_DISPATCH", now: T5 });
  const executing = advanceWorkCaseLayer(dispatch, { expectedVersion: 9, targetLayerId: "L09", gateArtifactRef: "DISPATCH-1@1", actorRole: "EXECUTION_CHANGE_CONTROL", now: T5 });
  const recovery = advanceWorkCaseLayer(executing, { expectedVersion: 10, targetLayerId: "L10", gateArtifactRef: "EXEC-1@1", actorRole: "RECOVERY_FAIRNESS", now: T5 });
  assert.equal(recovery.current.executionSnapshotRef, "EXEC-1@1");
  const redispatch = advanceWorkCaseLayer(recovery, { expectedVersion: 11, targetLayerId: "L08", gateArtifactRef: "RECOVERY-1@1", actorRole: "ROUTING_DISPATCH", now: T5 });
  assert.equal(redispatch.current.fulfillmentPlanRef, "FP-1@1");
  assert.equal(redispatch.current.executionSnapshotRef, null);
  assert.equal(redispatch.current.outcomeRef, null);
});

test("TaskBlock identity survives ordinal movement when the requested outcome is unchanged", () => {
  let nextId = 0;
  const makeId = () => `task-${++nextId}`;
  const first = reconcileTaskIdentities([], [
    { title: "Pick up dishwasher", domain: "transport_handling", ordinal: 1 },
    { title: "Install dishwasher", domain: "appliance_installation", ordinal: 2 },
  ], makeId);
  const second = reconcileTaskIdentities(first, [
    { title: "Install dishwasher", domain: "appliance_installation", ordinal: 1 },
    { title: "Pick up dishwasher", domain: "transport_handling", ordinal: 2 },
  ], makeId);
  assert.equal(second.find(t => t.title === "Pick up dishwasher")?.taskId, first.find(t => t.title === "Pick up dishwasher")?.taskId);
  assert.equal(second.find(t => t.title === "Install dishwasher")?.taskId, first.find(t => t.title === "Install dishwasher")?.taskId);
});

test("new requested outcome gets a new TaskBlock id and removed outcome retires explicitly", () => {
  let nextId = 0;
  const makeId = () => `task-${++nextId}`;
  const first = reconcileTaskIdentities([], [{ title: "Carry boxes", domain: "transport_handling", ordinal: 1 }], makeId);
  const second = reconcileTaskIdentities(first, [{ title: "Mount TV", domain: "mounting", ordinal: 1 }], makeId);
  assert.equal(second.find(t => t.title === "Mount TV")?.taskId, "task-2");
  assert.equal(second.find(t => t.title === "Carry boxes")?.status, "RETIRED");
});
