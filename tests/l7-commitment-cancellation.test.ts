/**
 * L7 — Commitment, Capacity, Rescheduling & Cancellation.
 *
 * The three golden scenarios for this layer move from todo to asserting here.
 * The rest are the invariants canon calls non-negotiable, written so that
 * breaking one turns the suite red rather than requiring somebody to notice.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  beginCommitment, holdCapacity, withReservations, recordPreparation,
  recordReallocation, netLostMinutes, netLostByRole, COMMITMENT_LADDER,
  CommitmentInvariantError, isVoluntary,
  type CommitmentPolicy, type CommitmentStage, type CapacityReservation,
} from "../lib/layers/l7/commitment";
import {
  requestCancellation, takeSnapshot, CANCELLATION_SEQUENCE,
  type CancellationPorts, type CancellationRequest, type RescheduleOption,
} from "../lib/layers/l7/cancellation";

const T0 = "2026-09-01T08:00:00.000Z";
const T1 = "2026-09-01T09:00:00.000Z";
const START = "2026-09-02T09:00:00.000Z";

/**
 * A test policy. Every threshold lives here, in the caller — which is the point.
 * Canon: "no universal cancellation hours/percentages are canonical."
 */
function policy(over: Partial<CommitmentPolicy> = {}): CommitmentPolicy {
  return {
    stageOf: i => i.workStarted ? "WORK_STARTED"
      : i.mobilizationStarted ? "MOBILIZED"
      : i.capacityHeld ? "CAPACITY_LOCKED"
      : i.providerAccepted ? "COMMITMENT_BEGINS" : "FREE_OR_LOW",
    isCostEligible: (_kind, stage) => stage !== "FREE_OR_LOW",
    requiresResponsibilityReview: i => i.disputed || i.netLostMinutes > 480,
    ...over,
  };
}
function ports(over: Partial<CancellationPorts> = {}): CancellationPorts {
  return {
    policy: policy(),
    rescheduleOptions: () => [],
    attemptBackfill: () => [],
    ...over,
  };
}
function twoPersonJob() {
  const s = beginCommitment({ jobOrderId: "JO-1", now: T0 });
  const rs = [
    holdCapacity({ reservationId: "R1", role: "lead", assigneeRef: "P-1", minutesReserved: 240, startsAt: START }),
    holdCapacity({ reservationId: "R2", role: "helper", assigneeRef: "P-2", minutesReserved: 240, startsAt: START }),
  ];
  return withReservations(s, rs, policy(), T0);
}
function request(over: Partial<CancellationRequest> = {}): CancellationRequest {
  return {
    requestId: "CX-1", jobOrderId: "JO-1", cause: "CUSTOMER_VOLUNTARY",
    requestedBy: "CUSTOMER", requestedAt: T1, disputed: false, ...over,
  };
}

// ---------------------------------------------------------------------------
// Golden regression scenarios
// ---------------------------------------------------------------------------

test("L7-G1 · Two-person accepted job creates two role reservations", () => {
  const s = twoPersonJob();
  assert.equal(s.reservations.length, 2);
  assert.deepEqual(s.reservations.map(r => r.role).sort(), ["helper", "lead"]);
  // One reservation per role, never one per job — protection is calculated per role.
  assert.deepEqual(netLostByRole(s.reservations), { lead: 240, helper: 240 });
  assert.equal(s.stage, "CAPACITY_LOCKED");
});

test("L7-G2 · Cancellation shortly before start triggers backfill before lost-capacity calculation", () => {
  const s = twoPersonJob();
  const out = requestCancellation({
    state: s, request: request(), now: T1,
    ports: ports({
      // The lead is fully rebooked; the helper only half.
      attemptBackfill: () => [
        { reservationId: "R1", minutes: 240 },
        { reservationId: "R2", minutes: 120 },
      ],
    }),
  });

  // Backfill ran BEFORE the measurement, and lowered it.
  assert.ok(out.steps.indexOf("CAPACITY_RECOVERY") < out.steps.indexOf("ELIGIBLE_COST"));
  assert.deepEqual(out.recovery.netLostByRole, { lead: 0, helper: 120 });
  assert.equal(out.recovery.netLostTotalMinutes, 120);

  // Net lost capacity = reserved − reallocated. A fully rebooked role lost nothing.
  const lost = out.instruction.eligibleCosts.filter(c => c.kind === "NET_LOST_CAPACITY");
  assert.deepEqual(lost.map(c => [c.role, c.minutes]), [["helper", 120]]);
});

test("L7-G3 · Reschedule keeps same team when feasible", () => {
  const options: RescheduleOption[] = [
    { startsAt: "2026-09-03T09:00:00.000Z", sameTeam: false, feasible: true },
    { startsAt: "2026-09-04T09:00:00.000Z", sameTeam: true, feasible: true },
    { startsAt: "2026-09-02T14:00:00.000Z", sameTeam: true, feasible: false },
  ];
  const out = requestCancellation({
    state: twoPersonJob(), request: request(), now: T1,
    ports: ports({ rescheduleOptions: () => options }),
  });
  assert.ok(out.resolvedByReschedule, "a feasible option should be preferred over closure");
  assert.equal(out.resolvedByReschedule!.sameTeam, true, "same team is preferred");
  assert.equal(out.resolvedByReschedule!.feasible, true, "an infeasible option must never be offered");
});

// ---------------------------------------------------------------------------
// Non-negotiable invariants
// ---------------------------------------------------------------------------

test("cancellation is requestable from every stage, including once work has started", () => {
  for (const stage of COMMITMENT_LADDER) {
    const pinned = policy({ stageOf: () => stage as CommitmentStage });
    const s = withReservations(
      beginCommitment({ jobOrderId: "JO-1", now: T0 }),
      [holdCapacity({ reservationId: "R1", role: "lead", assigneeRef: "P-1", minutesReserved: 120, startsAt: START })],
      pinned, T0,
    );
    const out = requestCancellation({ state: s, request: request(), ports: ports({ policy: pinned }), now: T1 });
    assert.equal(out.instruction.stageAtRequest, stage,
      "cancellation must be reachable from every stage, WORK_STARTED included");
  }
});

test("the cancellation path runs in the canonical order", () => {
  const out = requestCancellation({ state: twoPersonJob(), request: request(), ports: ports(), now: T1 });
  assert.deepEqual(out.steps, CANCELLATION_SEQUENCE);
});

test("capacity recovery precedes responsibility allocation", () => {
  // L7 lists L09B's assessment as an input while L09B lists L7's recovery attempt
  // as an input. Neither document sequenced it. The board does: recovery first,
  // because net lost capacity is the question L09B is asked.
  const out = requestCancellation({ state: twoPersonJob(), request: request(), ports: ports(), now: T1 });
  assert.ok(out.steps.indexOf("CAPACITY_RECOVERY") < out.steps.indexOf("RESPONSIBILITY"));
});

test("a field-reality block is never settled as a voluntary cancellation", () => {
  // "Voluntary cancellation is not a Field Reality Block."
  const out = requestCancellation({
    state: twoPersonJob(), ports: ports(), now: T1,
    request: request({ cause: "FIELD_REALITY_UNRECOVERABLE", requestedBy: "SYSTEM" }),
  });
  assert.equal(out.instruction.responsibility, "REFERRED_TO_L09B");
  assert.equal(out.instruction.awaitingCustomerConfirmation, false);
  assert.equal(isVoluntary("FIELD_REALITY_UNRECOVERABLE"), false);
});

test("a disputed cancellation is referred, never settled by L7 alone", () => {
  const out = requestCancellation({
    state: twoPersonJob(), ports: ports(), now: T1, request: request({ disputed: true }),
  });
  assert.equal(out.instruction.responsibility, "REFERRED_TO_L09B");
});

test("the settlement instruction carries quantities, never money", () => {
  const out = requestCancellation({ state: twoPersonJob(), request: request(), ports: ports(), now: T1 });
  const json = JSON.stringify(out.instruction);
  for (const forbidden of ["amount", "price", "currency", "cad", "total", "fee"]) {
    assert.ok(!json.toLowerCase().includes(forbidden),
      `L7 must not price a cancellation; found "${forbidden}" in the instruction`);
  }
  assert.equal(out.instruction.chargesFullUnperformedJob, false);
});

test("backfill cannot exceed what was reserved", () => {
  const r = holdCapacity({ reservationId: "R1", role: "lead", assigneeRef: "P-1", minutesReserved: 120, startsAt: START });
  assert.throws(() => recordReallocation(r, 121),
    (e: unknown) => e instanceof CommitmentInvariantError && e.invariant === "OVER_REALLOCATION");
  assert.equal(netLostMinutes(recordReallocation(r, 120)), 0);
});

test("no new commitments are taken once a cancellation is in flight", () => {
  const out = requestCancellation({ state: twoPersonJob(), request: request(), ports: ports(), now: T1 });
  assert.equal(out.commitment.frozen, true);
  assert.throws(
    () => withReservations(out.commitment,
      [holdCapacity({ reservationId: "R3", role: "extra", assigneeRef: "P-3", minutesReserved: 60, startsAt: START })],
      policy(), T1),
    (e: unknown) => e instanceof CommitmentInvariantError && e.invariant === "COMMITMENTS_FROZEN");
});

test("the snapshot does not move when capacity is reallocated afterwards", () => {
  const s = twoPersonJob();
  const snap = takeSnapshot(s, T1, "CAPACITY_LOCKED");
  const out = requestCancellation({
    state: s, request: request(), now: T1,
    ports: ports({ attemptBackfill: () => [{ reservationId: "R1", minutes: 240 }] }),
  });
  assert.deepEqual(snap.reservedMinutesByRole, { lead: 240, helper: 240 });
  assert.deepEqual(out.snapshot.reservedMinutesByRole, { lead: 240, helper: 240 },
    "the snapshot records what was committed at request time, not after backfill");
  assert.equal(out.recovery.netLostByRole.lead, 0);
});

test("preparation is recorded against a real reservation", () => {
  const s = twoPersonJob();
  assert.throws(
    () => recordPreparation(s, { reservationId: "NOPE", preparationMinutes: 30, mobilizationMinutes: 0, externalCostRefs: [] }, policy(), T1),
    (e: unknown) => e instanceof CommitmentInvariantError && e.invariant === "UNKNOWN_RESERVATION");
});

test("mobilisation that actually happened is eligible; nothing is eligible at FREE_OR_LOW", () => {
  let s = twoPersonJob();
  s = recordPreparation(s, { reservationId: "R1", preparationMinutes: 20, mobilizationMinutes: 45, externalCostRefs: ["RCPT-1"] }, policy(), T1);
  const out = requestCancellation({ state: s, request: request(), ports: ports(), now: T1 });
  const kinds = out.instruction.eligibleCosts.map(c => c.kind);
  assert.ok(kinds.includes("MOBILIZATION"));
  assert.ok(kinds.includes("EXTERNAL"));

  const free = requestCancellation({
    state: s, request: request(), now: T1,
    ports: ports({ policy: policy({ stageOf: () => "FREE_OR_LOW", isCostEligible: (_k, st) => st !== "FREE_OR_LOW" }) }),
  });
  assert.deepEqual(free.instruction.eligibleCosts, [], "nothing is owed before commitment begins");
});

test("a reservation must name a role and a person", () => {
  const base = { reservationId: "R1", role: "lead", assigneeRef: "P-1", minutesReserved: 60, startsAt: START };
  assert.throws(() => holdCapacity({ ...base, role: "  " }),
    (e: unknown) => e instanceof CommitmentInvariantError && e.invariant === "ROLE_REQUIRED");
  assert.throws(() => holdCapacity({ ...base, assigneeRef: "" }),
    (e: unknown) => e instanceof CommitmentInvariantError && e.invariant === "ASSIGNEE_REQUIRED");
  assert.throws(() => holdCapacity({ ...base, minutesReserved: 0 }),
    (e: unknown) => e instanceof CommitmentInvariantError && e.invariant === "RESERVED_MINUTES");
});

test("no threshold is hardcoded in the layer", async () => {
  // The superseded Layer 7 v1.0 poster carried a fixed fee table and fixed
  // windows. That is what this layer must never grow back.
  const { readFileSync } = await import("node:fs");
  for (const f of ["lib/layers/l7/commitment.ts", "lib/layers/l7/cancellation.ts"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf-8")
      .split("\n").filter(l => !l.trim().startsWith("*") && !l.trim().startsWith("//")).join("\n");
    assert.ok(!/\b\d+\s*(hours?|hrs?|days?)\b/i.test(src), `${f} names a time window`);
    assert.ok(!/\b\d+\s*%/.test(src), `${f} names a percentage`);
  }
});
