/**
 * L7 — the cancellation path.
 *
 * The order of the steps below is not an implementation preference. It is the
 * sequence printed on the L7 board:
 *
 *   freeze new commitments -> CommitmentSnapshot -> reschedule test ->
 *   capacity recovery/backfill -> unavoidable eligible cost ->
 *   responsibility allocation -> customer confirmation -> L12 settlement
 *
 * That sequence also settles a contradiction recorded earlier as unresolved:
 * L7 lists L09B's ResponsibilityAssessment as an input while L09B lists L7's
 * CapacityRecoveryAttempt as an input, with neither document saying which runs
 * first. It is capacity recovery, then responsibility — net lost capacity
 * cannot be measured before backfill has been attempted, so L09B cannot be
 * asked the question until L7 has the number.
 *
 * `steps` on the result records what actually ran, in order, so the sequence is
 * assertable rather than merely intended.
 */

import {
  type CancellationCause, type CapacityReservation, type CommitmentPolicy,
  type CommitmentState, type EligibleCostKind, type CommitmentStage,
  CommitmentInvariantError, currentStage, freezeCommitments, isVoluntary,
  netLostByRole, netLostMinutes, recordReallocation,
} from "./commitment";

export type CancellationRequest = {
  readonly requestId: string;
  readonly jobOrderId: string;
  readonly cause: CancellationCause;
  readonly requestedBy: "CUSTOMER" | "PROVIDER" | "DONEEO" | "SYSTEM";
  readonly requestedAt: string;
  readonly disputed: boolean;
};

/**
 * The state of the world at the instant cancellation was requested. Frozen, so
 * later reallocation cannot rewrite what was committed at request time.
 */
export type CommitmentSnapshot = {
  readonly jobOrderId: string;
  readonly takenAt: string;
  readonly stage: CommitmentStage;
  readonly reservations: readonly CapacityReservation[];
  readonly reservedMinutesByRole: Record<string, number>;
};

export type RescheduleOption = {
  readonly startsAt: string;
  /** Canon prefers the same provider/team/resources first where feasible. */
  readonly sameTeam: boolean;
  readonly feasible: boolean;
};

export type CapacityRecoveryAttempt = {
  readonly attemptedAt: string;
  readonly reallocations: readonly { reservationId: string; minutes: number }[];
  readonly reservationsAfter: readonly CapacityReservation[];
  readonly netLostByRole: Record<string, number>;
  readonly netLostTotalMinutes: number;
};

export type EligibleCost = {
  readonly kind: EligibleCostKind;
  readonly role: string;
  /** Minutes or a reference — never a monetary amount. L12 prices this. */
  readonly minutes?: number;
  readonly externalCostRef?: string;
};

/**
 * What L7 hands downstream.
 *
 * Deliberately contains no money. L6 owns price, L09B owns who is responsible,
 * L12 owns the ledger. If a currency field ever appears on this type, three
 * layer boundaries have been crossed at once.
 */
export type CancellationSettlementInstruction = {
  readonly jobOrderId: string;
  readonly requestId: string;
  readonly cause: CancellationCause;
  readonly stageAtRequest: CommitmentStage;
  readonly netLostByRole: Record<string, number>;
  readonly eligibleCosts: readonly EligibleCost[];
  /** Where responsibility is decided. L7 never adjudicates a contested case. */
  readonly responsibility: "APPLIED_BY_POLICY" | "REFERRED_TO_L09B";
  /** True until the customer has seen the consequences, where policy requires it. */
  readonly awaitingCustomerConfirmation: boolean;
  /**
   * Always false. Present because the invariant is load-bearing and worth being
   * unable to express: "customer never automatically pays full original price
   * for unperformed work."
   */
  readonly chargesFullUnperformedJob: false;
};

export type CancellationStep =
  | "FREEZE" | "SNAPSHOT" | "RESCHEDULE_TEST" | "CAPACITY_RECOVERY"
  | "ELIGIBLE_COST" | "RESPONSIBILITY" | "CUSTOMER_CONFIRMATION" | "SETTLEMENT_HANDOFF";

export const CANCELLATION_SEQUENCE: readonly CancellationStep[] = Object.freeze([
  "FREEZE", "SNAPSHOT", "RESCHEDULE_TEST", "CAPACITY_RECOVERY",
  "ELIGIBLE_COST", "RESPONSIBILITY", "CUSTOMER_CONFIRMATION", "SETTLEMENT_HANDOFF",
]);

export type CancellationOutcome = {
  readonly request: CancellationRequest;
  readonly snapshot: CommitmentSnapshot;
  readonly rescheduleOffered: readonly RescheduleOption[];
  readonly recovery: CapacityRecoveryAttempt;
  readonly instruction: CancellationSettlementInstruction;
  readonly commitment: CommitmentState;
  /** What ran, in order. Asserted against CANCELLATION_SEQUENCE. */
  readonly steps: readonly CancellationStep[];
  /** Set when a reschedule was accepted instead — the job is not cancelled. */
  readonly resolvedByReschedule: RescheduleOption | null;
};

export type CancellationPorts = {
  readonly policy: CommitmentPolicy;
  /** L7 asks; L4/L5 answer. Same team first where feasible. */
  rescheduleOptions(input: { snapshot: CommitmentSnapshot }): readonly RescheduleOption[];
  /** Backfill attempt. Returns minutes successfully given to other work. */
  attemptBackfill(input: { snapshot: CommitmentSnapshot }): readonly { reservationId: string; minutes: number }[];
};

/**
 * `stage` is passed in rather than read off the state, so the caller is forced
 * to say which moment the snapshot describes. See currentStage().
 */
export function takeSnapshot(state: CommitmentState, at: string, stage: CommitmentStage): CommitmentSnapshot {
  const byRole: Record<string, number> = {};
  for (const r of state.reservations) byRole[r.role] = (byRole[r.role] ?? 0) + r.minutesReserved;
  return Object.freeze({
    jobOrderId: state.jobOrderId,
    takenAt: at,
    stage,
    reservations: Object.freeze(state.reservations.map(r => Object.freeze({ ...r }))),
    reservedMinutesByRole: Object.freeze(byRole),
  });
}

/**
 * Run the cancellation path.
 *
 * Requestable from any stage, including WORK_STARTED. Canon states this twice —
 * as an L7 invariant and, in L11's outcome machine, as the transition
 * `Any -> S5 on cancellation from L07`. There is deliberately no stage check
 * guarding entry to this function.
 */
export function requestCancellation(input: {
  state: CommitmentState;
  request: CancellationRequest;
  ports: CancellationPorts;
  now: string;
}): CancellationOutcome {
  const { state, request, ports, now } = input;
  if (request.jobOrderId !== state.jobOrderId) {
    throw new CommitmentInvariantError("JOB_ORDER_MISMATCH", "cancellation request names a different JobOrder");
  }
  const steps: CancellationStep[] = [];

  // 1. Freeze, so the snapshot cannot move while it is taken.
  const frozen = freezeCommitments(state, now);
  steps.push("FREEZE");

  // 2. Snapshot what was committed at request time, at the stage reached BY now.
  const snapshot = takeSnapshot(frozen, now, currentStage(frozen, ports.policy, now));
  steps.push("SNAPSHOT");

  // 3. Retention before closure: offer a reschedule, same team first.
  const offered = ports.rescheduleOptions({ snapshot });
  steps.push("RESCHEDULE_TEST");
  const preferred = [...offered]
    .filter(o => o.feasible)
    .sort((a, b) => Number(b.sameTeam) - Number(a.sameTeam))[0] ?? null;

  // 4. Backfill BEFORE measuring what was lost. This ordering is the whole
  //    point: reallocated capacity is not lost capacity.
  const reallocations = ports.attemptBackfill({ snapshot });
  const byId = new Map(snapshot.reservations.map(r => [r.reservationId, r]));
  for (const { reservationId, minutes } of reallocations) {
    const r = byId.get(reservationId);
    if (!r) throw new CommitmentInvariantError("UNKNOWN_RESERVATION", `backfill names unknown reservation ${reservationId}`);
    byId.set(reservationId, recordReallocation(r, minutes));
  }
  const after = [...byId.values()];
  const lostByRole = netLostByRole(after);
  const recovery: CapacityRecoveryAttempt = Object.freeze({
    attemptedAt: now,
    reallocations: Object.freeze([...reallocations]),
    reservationsAfter: Object.freeze(after),
    netLostByRole: Object.freeze(lostByRole),
    netLostTotalMinutes: after.reduce((s, r) => s + netLostMinutes(r), 0),
  });
  steps.push("CAPACITY_RECOVERY");

  // 5. Eligible cost, per role, by policy. Eligibility only — no pricing.
  const eligible: EligibleCost[] = [];
  for (const r of after) {
    const prep = frozen.preparation.filter(p => p.reservationId === r.reservationId);
    for (const p of prep) {
      if (p.preparationMinutes > 0 && ports.policy.isCostEligible("PREPARATION", snapshot.stage)) {
        eligible.push(Object.freeze({ kind: "PREPARATION", role: r.role, minutes: p.preparationMinutes }));
      }
      if (p.mobilizationMinutes > 0 && ports.policy.isCostEligible("MOBILIZATION", snapshot.stage)) {
        eligible.push(Object.freeze({ kind: "MOBILIZATION", role: r.role, minutes: p.mobilizationMinutes }));
      }
      for (const ref of p.externalCostRefs) {
        if (ports.policy.isCostEligible("EXTERNAL", snapshot.stage)) {
          eligible.push(Object.freeze({ kind: "EXTERNAL", role: r.role, externalCostRef: ref }));
        }
      }
    }
    const lost = netLostMinutes(r);
    if (lost > 0 && ports.policy.isCostEligible("NET_LOST_CAPACITY", snapshot.stage)) {
      eligible.push(Object.freeze({ kind: "NET_LOST_CAPACITY", role: r.role, minutes: lost }));
    }
  }
  steps.push("ELIGIBLE_COST");

  // 6. Responsibility. L7 applies policy to clear cases and refers the rest.
  //    A field-reality block is never treated as a voluntary cancellation.
  const referred = ports.policy.requiresResponsibilityReview({
    stage: snapshot.stage,
    cause: request.cause,
    netLostMinutes: recovery.netLostTotalMinutes,
    disputed: request.disputed,
  }) || !isVoluntary(request.cause);
  steps.push("RESPONSIBILITY");

  // 7. Show the customer the consequences before closing, where policy allows.
  const awaiting = isVoluntary(request.cause) && eligible.length > 0;
  steps.push("CUSTOMER_CONFIRMATION");

  // 8. Hand facts to L12. L7 never posts to the ledger.
  const instruction: CancellationSettlementInstruction = Object.freeze({
    jobOrderId: state.jobOrderId,
    requestId: request.requestId,
    cause: request.cause,
    stageAtRequest: snapshot.stage,
    netLostByRole: recovery.netLostByRole,
    eligibleCosts: Object.freeze(eligible),
    responsibility: referred ? "REFERRED_TO_L09B" : "APPLIED_BY_POLICY",
    awaitingCustomerConfirmation: awaiting,
    chargesFullUnperformedJob: false,
  });
  steps.push("SETTLEMENT_HANDOFF");

  return Object.freeze({
    request,
    snapshot,
    rescheduleOffered: Object.freeze([...offered]),
    recovery,
    instruction,
    commitment: frozen,
    steps: Object.freeze(steps),
    resolvedByReschedule: preferred,
  });
}
