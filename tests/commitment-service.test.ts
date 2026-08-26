/**
 * L7 wired to storage.
 *
 * The layer's own invariants are covered in l7-commitment-cancellation.test.ts.
 * What is tested here is the wiring: that capacity is held against people
 * rather than offers, that stage is recomputed rather than remembered across a
 * write, and that a retried chain of commands replays instead of failing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { CommitmentService, CommitmentServiceError } from "../lib/application/commitment-service";
import type { CommitmentStore, StoredCommitment, CommitmentEvent } from "../lib/application/commitment-store";
import type { StoredCommand } from "../lib/application/requirement-contract-store";
import type { CapacityReservation, PreparationRecord } from "../lib/layers/l7/commitment";
import { MONTREAL_PILOT } from "../lib/policy/montreal-pilot";

const START = "2026-09-10T14:00:00.000Z";
const before = (m: number) => new Date(Date.parse(START) - m * 60_000).toISOString();
const FAR = before(72 * 60);   // outside the 24h lock
const NEAR = before(3 * 60);   // inside it

class MemoryStore implements CommitmentStore {
  commitments = new Map<string, StoredCommitment>();
  commands = new Map<string, StoredCommand>();
  events: CommitmentEvent[] = [];
  accepted: { executorId: string; role: string; isLead: boolean }[] = [
    { executorId: "ex-lead", role: "lead", isLead: true },
    { executorId: "ex-helper", role: "helper", isLead: false },
  ];

  async get(id: string) { return this.commitments.get(id) ?? null; }
  async getCommand(k: string) { return this.commands.get(k) ?? null; }
  async acceptedAssignments() { return this.accepted; }
  async reservations(id: string): Promise<readonly CapacityReservation[]> {
    return this.commitments.get(id)?.state.reservations ?? [];
  }
  async openAtomic(i: { commitment: StoredCommitment; command: StoredCommand; event: CommitmentEvent }) {
    if (this.commitments.has(i.commitment.state.jobOrderId)) throw new Error("already open");
    this.commitments.set(i.commitment.state.jobOrderId, i.commitment);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async saveAtomic(i: { previous: StoredCommitment; next: StoredCommitment; command: StoredCommand; event: CommitmentEvent }) {
    const live = this.commitments.get(i.next.state.jobOrderId);
    // Mirror the real store's optimistic check — a fake that enforces nothing
    // would let a stale-version bug pass.
    if (!live || live.stateVersion !== i.previous.stateVersion) {
      throw new Error(`concurrent modification of ${i.next.state.jobOrderId}`);
    }
    this.commitments.set(i.next.state.jobOrderId, i.next);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
}

function svc(store = new MemoryStore()) {
  return {
    store,
    service: new CommitmentService(store, { name: MONTREAL_PILOT.name, commitment: MONTREAL_PILOT.commitment }),
  };
}

const hold = (service: CommitmentService, now = FAR, commandKey = "cmd-hold") =>
  service.holdCapacityForJob({
    commandKey, jobOrderId: "JOB-1", workCaseId: "WC-1", startsAt: START,
    minutesPerRole: 240, correlationId: "corr-1", now,
  });

const PREP: PreparationRecord = {
  reservationId: "RES-JOB-1-ex-lead", preparationMinutes: 30,
  mobilizationMinutes: 0, externalCostRefs: [],
};

// ---------------------------------------------------------------------------

test("capacity is held per accepted role, one reservation each", async () => {
  const { service } = svc();
  const { commitment } = await hold(service);
  assert.equal(commitment.state.reservations.length, 2);
  assert.deepEqual(commitment.state.reservations.map(r => r.role).sort(), ["helper", "lead"]);
  for (const r of commitment.state.reservations) {
    assert.equal(r.minutesReserved, 240);
    assert.equal(r.status, "HELD");
  }
});

test("capacity is never held against an offer nobody accepted", async () => {
  const { store, service } = svc();
  store.accepted = [];
  await assert.rejects(() => hold(service), (e: unknown) =>
    e instanceof CommitmentServiceError && e.code === "NO_ACCEPTED_ASSIGNMENTS");
});

test("the governing policy is stored with the commitment", async () => {
  const { service } = svc();
  const { commitment } = await hold(service);
  assert.equal(commitment.policyName, "montreal-pilot",
    "a later policy must not silently reinterpret terms the customer was shown");
});

test("stage is recomputed against the clock, not read back from the write", async () => {
  const { service } = svc();
  const { commitment, stage } = await hold(service, FAR);
  assert.equal(stage, "COMMITMENT_BEGINS", "72h out, capacity is still releasable");

  // Same stored state, later clock. Nothing was written in between.
  assert.equal(service.stageOf(commitment, NEAR), "CAPACITY_LOCKED",
    "the ladder climbs with time alone; a stored stage would still say COMMITMENT_BEGINS");
});

test("recording travel moves the case to MOBILIZED", async () => {
  const { service } = svc();
  const { commitment } = await hold(service);
  const { commitment: after, stage } = await service.recordPreparation({
    commandKey: "cmd-prep", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    record: { ...PREP, mobilizationMinutes: 45 }, correlationId: "corr-1", now: NEAR,
  });
  assert.equal(stage, "MOBILIZED");
  assert.ok(after.mobilizationStartedAt);
});

test("WORK_STARTED is reachable, and re-reporting a start does not move it", async () => {
  const { service } = svc();
  const { commitment } = await hold(service);
  const first = await service.startWork({
    commandKey: "cmd-start", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    correlationId: "corr-1", now: NEAR,
  });
  assert.equal(first.stage, "WORK_STARTED");
  assert.equal(first.commitment.workStartedAt, NEAR);

  const later = "2026-09-10T15:30:00.000Z";
  const again = await service.startWork({
    commandKey: "cmd-start-2", jobOrderId: "JOB-1", expectedVersion: first.commitment.stateVersion,
    correlationId: "corr-1", now: later,
  });
  assert.equal(again.commitment.workStartedAt, NEAR, "the first start stands; reality is reported late");
});

test("a stale expectedVersion is refused", async () => {
  const { service } = svc();
  const { commitment } = await hold(service);
  await service.recordPreparation({
    commandKey: "cmd-p1", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    record: PREP, correlationId: "corr-1", now: FAR,
  });
  await assert.rejects(() => service.recordPreparation({
    commandKey: "cmd-p2", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    record: { ...PREP, preparationMinutes: 15 }, correlationId: "corr-1", now: FAR,
  }), (e: unknown) => e instanceof CommitmentServiceError && e.code === "STALE_VERSION");
});

test("a retried chain replays instead of failing — the defect that shipped once", async () => {
  const { service } = svc();
  const first = await hold(service);
  assert.equal(first.replayed, false);

  // Retry the same hold. It must replay, returning current state...
  const retry = await hold(service);
  assert.equal(retry.replayed, true);

  // ...and the NEXT command in the chain must still work. This is the exact
  // shape that broke: replay returns current state, and the following command
  // hashes the version it expected, so a hashed expectedVersion made an
  // identical retry look like a different command.
  const prep = await service.recordPreparation({
    commandKey: "cmd-prep", jobOrderId: "JOB-1", expectedVersion: retry.commitment.stateVersion,
    record: PREP, correlationId: "corr-1", now: FAR,
  });
  assert.equal(prep.replayed, false);
  assert.equal(prep.commitment.stateVersion, 2);
});

test("reusing a command key with different arguments is an error", async () => {
  const { service } = svc();
  await hold(service);
  await assert.rejects(() => service.holdCapacityForJob({
    commandKey: "cmd-hold", jobOrderId: "JOB-1", workCaseId: "WC-1", startsAt: START,
    minutesPerRole: 999, correlationId: "corr-1", now: FAR,
  }), (e: unknown) => e instanceof CommitmentServiceError && e.code === "KEY_REUSED");
});

test("cancellation runs the canonical sequence and is not re-runnable", async () => {
  const { service, store } = svc();
  const { commitment } = await hold(service);

  const { outcome } = await service.cancel({
    commandKey: "cmd-cancel", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    request: {
      jobOrderId: "JOB-1", cause: "CUSTOMER_VOLUNTARY", requestedAt: NEAR,
      requestedBy: "customer", disputed: false,
    },
    ports: {
      rescheduleOptions: () => [],
      // The lead's slot gets rebooked in full; the helper's does not.
      attemptBackfill: () => [{ reservationId: "RES-JOB-1-ex-lead", minutes: 240 }],
    },
    correlationId: "corr-1", now: NEAR,
  });

  assert.deepEqual(outcome.steps.slice(0, 4), ["FREEZE", "SNAPSHOT", "RESCHEDULE_TEST", "CAPACITY_RECOVERY"],
    "backfill must run before loss is measured — reallocated capacity is not lost capacity");
  assert.equal(outcome.recovery.netLostTotalMinutes, 240, "only the helper's slot was actually lost");
  assert.deepEqual(outcome.recovery.netLostByRole, { lead: 0, helper: 240 });
  assert.equal(store.commitments.get("JOB-1")!.state.frozen, true);

  // Re-running a cancellation must not quietly produce a second settlement.
  await assert.rejects(() => service.cancel({
    commandKey: "cmd-cancel", jobOrderId: "JOB-1", expectedVersion: 2,
    request: {
      jobOrderId: "JOB-1", cause: "CUSTOMER_VOLUNTARY", requestedAt: NEAR,
      requestedBy: "customer", disputed: false,
    },
    ports: { rescheduleOptions: () => [], attemptBackfill: () => [] },
    correlationId: "corr-1", now: NEAR,
  }), (e: unknown) => e instanceof CommitmentServiceError && e.code === "CANCELLATION_ALREADY_RUN");
});

test("cancellation is reachable from WORK_STARTED", async () => {
  const { service } = svc();
  const { commitment } = await hold(service);
  const started = await service.startWork({
    commandKey: "cmd-start", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    correlationId: "corr-1", now: NEAR,
  });
  assert.equal(started.stage, "WORK_STARTED");

  const { outcome } = await service.cancel({
    commandKey: "cmd-cancel", jobOrderId: "JOB-1", expectedVersion: started.commitment.stateVersion,
    request: {
      jobOrderId: "JOB-1", cause: "SAFETY_OR_REGULATORY", requestedAt: NEAR,
      requestedBy: "executor", disputed: false,
    },
    ports: { rescheduleOptions: () => [], attemptBackfill: () => [] },
    correlationId: "corr-1", now: NEAR,
  });
  assert.equal(outcome.snapshot.stage, "WORK_STARTED",
    "canon: Any -> S5 on cancellation from L07, with no stage guard");
});

test("every write emits exactly one event", async () => {
  const { service, store } = svc();
  const { commitment } = await hold(service);
  await service.recordPreparation({
    commandKey: "cmd-prep", jobOrderId: "JOB-1", expectedVersion: commitment.stateVersion,
    record: PREP, correlationId: "corr-1", now: FAR,
  });
  assert.deepEqual(store.events.map(e => e.eventType), ["CapacityHeld", "PreparationRecorded"]);
  for (const e of store.events) assert.equal(e.jobOrderId, "JOB-1");
});
