/**
 * L7 — Commitment, Capacity, Rescheduling & Cancellation.
 * Commitment state and capacity reservations.
 *
 * Two things here are structural, not stylistic:
 *
 * 1. NO THRESHOLD IS HARDCODED. The canonical invariant is "no universal
 *    cancellation hours/percentages are canonical" — the superseded Layer 7 v1.0
 *    poster carried a fixed fee table and that is precisely what was wrong with
 *    it. Every threshold arrives through CommitmentPolicy, which the caller
 *    supplies. If you find yourself typing a number of hours into this file,
 *    the architecture says you are writing a bug.
 *
 * 2. THIS LAYER PRODUCES QUANTITIES, NEVER AMOUNTS. L6 owns price, L09B owns
 *    responsibility, L12 owns the ledger. L7 measures reserved and reallocated
 *    capacity and hands the facts on. There is deliberately no money type in
 *    this module.
 */

/**
 * The commitment ladder, recovered from the L7 board's SPECIAL CONTROL panel —
 * a panel both the v2.1 reconciliation and the first pass of this work had
 * dropped, which is why "cancellation has no representation" was recorded as a
 * gap when in fact the model existed.
 *
 * Where a case sits on this ladder governs what a cancellation costs to unwind.
 * It does NOT govern whether cancellation may be requested: it always may.
 */
export type CommitmentStage =
  | "FREE_OR_LOW"        // nothing reserved that cannot be released
  | "COMMITMENT_BEGINS"  // customer has authorised; provider not yet locked
  | "CAPACITY_LOCKED"    // reservations held against named roles
  | "MOBILIZED"          // travel or preparation has actually begun
  | "WORK_STARTED";      // execution underway

export const COMMITMENT_LADDER: readonly CommitmentStage[] = Object.freeze([
  "FREE_OR_LOW", "COMMITMENT_BEGINS", "CAPACITY_LOCKED", "MOBILIZED", "WORK_STARTED",
]);

export class CommitmentInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "CommitmentInvariantError";
  }
}

/**
 * One reservation per assigned role, person or resource — never one per job.
 * A two-person job holds two reservations, so a cancellation can measure what
 * was actually lost per role rather than dividing a job-level guess.
 */
export type CapacityReservation = {
  readonly reservationId: string;
  readonly role: string;
  readonly assigneeRef: string;
  readonly minutesReserved: number;
  readonly startsAt: string;
  readonly status: "HELD" | "RELEASED" | "REALLOCATED" | "CONSUMED";
  /** Minutes successfully given to other work. Only meaningful once released. */
  readonly minutesReallocated: number;
};

export type PreparationRecord = {
  readonly reservationId: string;
  /** Preparation actually performed, evidenced. Not an estimate. */
  readonly preparationMinutes: number;
  readonly mobilizationMinutes: number;
  readonly externalCostRefs: readonly string[];
};

/**
 * Everything time- or policy-dependent enters through here.
 *
 * Implementations belong to configuration, not to this layer. A Montréal pilot
 * policy and a later multi-region policy are different objects; neither is
 * canon, and this module must work with both.
 */
export type CommitmentPolicy = {
  /** Where the case sits on the ladder, given real preparation/mobilisation facts. */
  stageOf(input: {
    readonly now: string;
    readonly startsAt: string;
    readonly providerAccepted: boolean;
    readonly capacityHeld: boolean;
    readonly mobilizationStarted: boolean;
    readonly workStarted: boolean;
  }): CommitmentStage;

  /** Whether a cost class is eligible for protection at this stage. Eligibility, not price. */
  isCostEligible(kind: EligibleCostKind, stage: CommitmentStage): boolean;

  /**
   * Whether this cancellation must be adjudicated by L09B rather than settled
   * by policy alone. High value, disputed cause, or mixed responsibility.
   */
  requiresResponsibilityReview(input: {
    readonly stage: CommitmentStage;
    readonly cause: CancellationCause;
    readonly netLostMinutes: number;
    readonly disputed: boolean;
  }): boolean;
};

export type EligibleCostKind =
  | "PREPARATION" | "MOBILIZATION" | "ACTUAL_WORK" | "NET_LOST_CAPACITY" | "EXTERNAL";

/**
 * Why the cancellation happened. This is NOT a blame assignment — L09B does
 * that. It is the distinction canon insists on: "voluntary cancellation is not
 * a Field Reality Block", because the two unwind differently.
 */
export type CancellationCause =
  | "CUSTOMER_VOLUNTARY"
  | "CUSTOMER_UNAVAILABLE"
  | "FIELD_REALITY_UNRECOVERABLE"   // arrives from L09A, not a customer choice
  | "PROVIDER_WITHDRAWAL"
  | "SAFETY_OR_REGULATORY"
  | "DONEEO_INITIATED";

export function isVoluntary(cause: CancellationCause): boolean {
  return cause === "CUSTOMER_VOLUNTARY";
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export function holdCapacity(input: {
  reservationId: string;
  role: string;
  assigneeRef: string;
  minutesReserved: number;
  startsAt: string;
}): CapacityReservation {
  if (!input.reservationId.trim()) throw new CommitmentInvariantError("RESERVATION_ID", "reservationId is required");
  if (!input.role.trim()) throw new CommitmentInvariantError("ROLE_REQUIRED", "a reservation is held against a role");
  if (!input.assigneeRef.trim()) throw new CommitmentInvariantError("ASSIGNEE_REQUIRED", "a reservation names a person or resource");
  if (!Number.isInteger(input.minutesReserved) || input.minutesReserved <= 0) {
    throw new CommitmentInvariantError("RESERVED_MINUTES", "reserved capacity must be a positive whole number of minutes");
  }
  return Object.freeze({
    reservationId: input.reservationId,
    role: input.role,
    assigneeRef: input.assigneeRef,
    minutesReserved: input.minutesReserved,
    startsAt: input.startsAt,
    status: "HELD" as const,
    minutesReallocated: 0,
  });
}

/**
 * Record a backfill. Capacity given to other work is capacity not lost.
 *
 * Canon: "Net Lost Reserved Capacity = Reserved Capacity − Successfully
 * Reallocated Capacity", and "backfill lowers Net Lost Reserved Capacity".
 * Reallocating more than was reserved is a measurement error, not a windfall.
 */
export function recordReallocation(
  reservation: CapacityReservation,
  minutes: number,
): CapacityReservation {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new CommitmentInvariantError("REALLOCATED_MINUTES", "reallocated minutes must be a non-negative whole number");
  }
  const total = reservation.minutesReallocated + minutes;
  if (total > reservation.minutesReserved) {
    throw new CommitmentInvariantError(
      "OVER_REALLOCATION",
      `cannot reallocate ${total} minutes against a ${reservation.minutesReserved}-minute reservation`,
    );
  }
  return Object.freeze({
    ...reservation,
    minutesReallocated: total,
    status: total === reservation.minutesReserved ? ("REALLOCATED" as const) : reservation.status,
  });
}

/** Net lost reserved capacity for one reservation. Never negative. */
export function netLostMinutes(r: CapacityReservation): number {
  return Math.max(0, r.minutesReserved - r.minutesReallocated);
}

/** Net lost capacity per role. Per role, because protection is calculated per role. */
export function netLostByRole(reservations: readonly CapacityReservation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reservations) out[r.role] = (out[r.role] ?? 0) + netLostMinutes(r);
  return out;
}

// ---------------------------------------------------------------------------
// Commitment state
// ---------------------------------------------------------------------------

export type CommitmentState = {
  readonly jobOrderId: string;
  readonly stage: CommitmentStage;
  readonly reservations: readonly CapacityReservation[];
  readonly preparation: readonly PreparationRecord[];
  readonly frozen: boolean;
  readonly updatedAt: string;
};

export function beginCommitment(input: { jobOrderId: string; now: string }): CommitmentState {
  if (!input.jobOrderId.trim()) throw new CommitmentInvariantError("JOB_ORDER_ID", "jobOrderId is required");
  return Object.freeze({
    jobOrderId: input.jobOrderId,
    stage: "FREE_OR_LOW" as const,
    reservations: Object.freeze([]),
    preparation: Object.freeze([]),
    frozen: false,
    updatedAt: input.now,
  });
}

export function withReservations(
  state: CommitmentState,
  reservations: readonly CapacityReservation[],
  policy: CommitmentPolicy,
  now: string,
): CommitmentState {
  if (state.frozen) {
    throw new CommitmentInvariantError("COMMITMENTS_FROZEN", "no new commitments once a cancellation is in flight");
  }
  if (reservations.length === 0) {
    throw new CommitmentInvariantError("RESERVATION_REQUIRED", "provider acceptance holds at least one reservation");
  }
  const all = [...state.reservations, ...reservations];
  const stage = policy.stageOf({
    now,
    startsAt: all[0]!.startsAt,
    providerAccepted: true,
    capacityHeld: true,
    mobilizationStarted: state.preparation.some(p => p.mobilizationMinutes > 0),
    workStarted: state.stage === "WORK_STARTED",
  });
  return Object.freeze({ ...state, reservations: Object.freeze(all), stage, updatedAt: now });
}

export function recordPreparation(
  state: CommitmentState,
  record: PreparationRecord,
  policy: CommitmentPolicy,
  now: string,
): CommitmentState {
  if (!state.reservations.some(r => r.reservationId === record.reservationId)) {
    throw new CommitmentInvariantError("UNKNOWN_RESERVATION", `no reservation ${record.reservationId} on this commitment`);
  }
  const preparation = [...state.preparation, record];
  const stage = policy.stageOf({
    now,
    startsAt: state.reservations[0]!.startsAt,
    providerAccepted: true,
    capacityHeld: true,
    mobilizationStarted: preparation.some(p => p.mobilizationMinutes > 0),
    workStarted: state.stage === "WORK_STARTED",
  });
  return Object.freeze({ ...state, preparation: Object.freeze(preparation), stage, updatedAt: now });
}

/**
 * The stage as of `now`, recomputed rather than remembered.
 *
 * A case climbs the ladder with the passage of time and nothing else: capacity
 * locked yesterday is closer to mobilisation today with no write in between.
 * Reading a stored `stage` at cancellation time therefore answers the wrong
 * question, which is what the L7 suite caught.
 */
export function currentStage(state: CommitmentState, policy: CommitmentPolicy, now: string): CommitmentStage {
  return policy.stageOf({
    now,
    startsAt: state.reservations[0]?.startsAt ?? now,
    providerAccepted: state.reservations.length > 0,
    capacityHeld: state.reservations.some(r => r.status === "HELD"),
    mobilizationStarted: state.preparation.some(p => p.mobilizationMinutes > 0),
    workStarted: state.stage === "WORK_STARTED",
  });
}

/**
 * Freeze new commitments. First step of the cancellation path, and the reason
 * it is first: the snapshot taken next must not move while it is being taken.
 */
export function freezeCommitments(state: CommitmentState, now: string): CommitmentState {
  return Object.freeze({ ...state, frozen: true, updatedAt: now });
}
