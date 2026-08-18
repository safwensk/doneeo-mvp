import test from "node:test";
import assert from "node:assert/strict";
import { beginArchitecting, beginFulfilling, createWorkCase, markRequirementReady, WorkCaseInvariantError } from "../lib/work-case";
import { reconcileTaskIdentities } from "../lib/intelligence-task-identity";

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T10:01:00.000Z";
const T3 = "2026-08-18T10:02:00.000Z";
const T4 = "2026-08-18T10:03:00.000Z";

test("control plane advances only through guarded authoritative states", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const architecting = beginArchitecting(created, { expectedVersion: 1, now: T2 });
  const ready = markRequirementReady(architecting, { expectedVersion: 2, requirementContractRef: "RC-1@1", now: T3 });
  const fulfilling = beginFulfilling(ready, { expectedVersion: 3, now: T4 });
  assert.equal(created.state, "REQUEST_RECEIVED");
  assert.equal(architecting.state, "ARCHITECTING");
  assert.equal(ready.state, "REQUIREMENT_READY");
  assert.equal(ready.current.requirementContractRef, "RC-1@1");
  assert.equal(fulfilling.state, "FULFILLING");
  assert.equal(fulfilling.stateVersion, 4);
});

test("stale expected-version command is rejected instead of silently overwriting state", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  assert.throws(() => beginArchitecting(created, { expectedVersion: 7, now: T2 }), (error: WorkCaseInvariantError) => error.invariant === "STALE_COMMAND");
});

test("fulfillment cannot start without a published Requirement Contract pointer", () => {
  const created = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const architecting = beginArchitecting(created, { expectedVersion: 1, now: T2 });
  assert.throws(() => beginFulfilling(architecting, { expectedVersion: 2, now: T3 }), (error: WorkCaseInvariantError) => error.invariant === "REQUIREMENT_REQUIRED" || error.invariant === "INVALID_TRANSITION");
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
