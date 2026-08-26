/**
 * L7 in the running system.
 *
 * Holds capacity against accepted assignments, records what was actually
 * prepared, and runs the cancellation path. The layer does the deciding; this
 * file supplies it with stored state, a policy, and the two ports cancellation
 * needs, then persists what comes back.
 *
 * IDEMPOTENCY
 *
 * Same contract as WorkCaseService: a commandKey replays, and reusing a key
 * with different arguments is an error. `expectedVersion` is deliberately NOT
 * part of any request hash — it is the concurrency precondition for WHEN a
 * command may apply, not part of WHAT the command is. Hashing it made an
 * identical retry against a moved state look like a different command, which
 * broke chained replay; that defect is fixed and must not come back.
 */

import {
  beginCommitment, withReservations, recordPreparation, markWorkStarted,
  holdCapacity, currentStage,
  type CommitmentState, type CommitmentPolicy, type CommitmentStage,
  type CapacityReservation, type PreparationRecord,
} from "../layers/l7/commitment";
import {
  requestCancellation, type CancellationRequest, type CancellationOutcome,
  type CancellationPorts,
} from "../layers/l7/cancellation";
import type { CommitmentStore, StoredCommitment, CommitmentEvent } from "./commitment-store";
import type { StoredCommand } from "./requirement-contract-store";
import { sha256Stable } from "./requirement-contract-hashing";

export type CommitmentPolicyConfig = {
  readonly name: string;
  readonly commitment: CommitmentPolicy;
};

/** What L7 needs from L4/L5 to answer a cancellation. Supplied per call. */
export type ReschedulePorts = Omit<CancellationPorts, "policy">;

export class CommitmentService {
  constructor(
    private readonly store: CommitmentStore,
    private readonly config: CommitmentPolicyConfig,
  ) {}

  /**
   * Open a commitment and hold capacity, one reservation per accepted role.
   *
   * Reservations are seeded from what L4 recorded as accepted — not from what
   * was offered. An offer nobody took has cost nobody anything.
   */
  async holdCapacityForJob(input: {
    commandKey: string;
    jobOrderId: string;
    workCaseId: string | null;
    startsAt: string;
    minutesPerRole: number;
    correlationId: string;
    now: string;
  }): Promise<{ commitment: StoredCommitment; stage: CommitmentStage; replayed: boolean }> {
    const requestHash = await sha256Stable({
      type: "HoldCapacity", jobOrderId: input.jobOrderId, startsAt: input.startsAt,
      minutesPerRole: input.minutesPerRole, correlationId: input.correlationId,
    });
    const replayed = await this.replay(input.commandKey, requestHash);
    if (replayed) {
      const existing = await this.require(input.jobOrderId);
      return { commitment: existing, stage: this.stageOf(existing, input.now), replayed: true };
    }

    const accepted = await this.store.acceptedAssignments(input.jobOrderId);
    if (accepted.length === 0) {
      throw new CommitmentServiceError(
        "NO_ACCEPTED_ASSIGNMENTS",
        `no accepted assignment for ${input.jobOrderId}; capacity is held against people, not against offers`,
      );
    }

    const reservations: CapacityReservation[] = accepted.map(a => holdCapacity({
      reservationId: `RES-${input.jobOrderId}-${a.executorId}`,
      role: a.role,
      assigneeRef: a.executorId,
      minutesReserved: input.minutesPerRole,
      startsAt: input.startsAt,
    }));

    const opened = beginCommitment({ jobOrderId: input.jobOrderId, now: input.now });
    const state = withReservations(opened, reservations, this.config.commitment, input.now);

    const commitment: StoredCommitment = Object.freeze({
      state,
      workCaseId: input.workCaseId,
      policyName: this.config.name,
      providerAccepted: true,
      mobilizationStartedAt: null,
      workStartedAt: null,
      stateVersion: 1,
    });

    await this.store.openAtomic({
      commitment,
      command: succeeded(input.commandKey, "HoldCapacity", requestHash, input.correlationId,
        JSON.stringify({ jobOrderId: input.jobOrderId, reservations: reservations.length })),
      event: event(input.jobOrderId, "CapacityHeld", input.correlationId, input.now,
        { reservations: reservations.map(r => r.reservationId) }),
    });
    return { commitment, stage: this.stageOf(commitment, input.now), replayed: false };
  }

  /** Record preparation actually performed. Travel minutes move the stage. */
  async recordPreparation(input: {
    commandKey: string;
    jobOrderId: string;
    expectedVersion: number;
    record: PreparationRecord;
    correlationId: string;
    now: string;
  }): Promise<{ commitment: StoredCommitment; stage: CommitmentStage; replayed: boolean }> {
    // expectedVersion is a precondition, not identity — see the header note.
    const requestHash = await sha256Stable({
      type: "RecordPreparation", jobOrderId: input.jobOrderId,
      record: input.record, correlationId: input.correlationId,
    });
    const replayed = await this.replay(input.commandKey, requestHash);
    const previous = await this.require(input.jobOrderId);
    if (replayed) return { commitment: previous, stage: this.stageOf(previous, input.now), replayed: true };
    this.checkVersion(previous, input.expectedVersion);

    const state = recordPreparation(previous.state, input.record, this.config.commitment, input.now);
    const mobilizing = input.record.mobilizationMinutes > 0;
    const next: StoredCommitment = Object.freeze({
      ...previous,
      state,
      mobilizationStartedAt: previous.mobilizationStartedAt ?? (mobilizing ? input.now : null),
      stateVersion: previous.stateVersion + 1,
    });

    await this.store.saveAtomic({
      previous, next, preparation: [input.record],
      command: succeeded(input.commandKey, "RecordPreparation", requestHash, input.correlationId,
        JSON.stringify({ jobOrderId: input.jobOrderId, stateVersion: next.stateVersion })),
      event: event(input.jobOrderId, mobilizing ? "MobilizationStarted" : "PreparationRecorded",
        input.correlationId, input.now, { reservationId: input.record.reservationId }),
    });
    return { commitment: next, stage: this.stageOf(next, input.now), replayed: false };
  }

  /** Record that work began. Re-reporting a start does not move it. */
  async startWork(input: {
    commandKey: string;
    jobOrderId: string;
    expectedVersion: number;
    correlationId: string;
    now: string;
  }): Promise<{ commitment: StoredCommitment; stage: CommitmentStage; replayed: boolean }> {
    const requestHash = await sha256Stable({
      type: "StartWork", jobOrderId: input.jobOrderId, correlationId: input.correlationId,
    });
    const replayed = await this.replay(input.commandKey, requestHash);
    const previous = await this.require(input.jobOrderId);
    if (replayed) return { commitment: previous, stage: this.stageOf(previous, input.now), replayed: true };
    this.checkVersion(previous, input.expectedVersion);

    const state = markWorkStarted(previous.state, this.config.commitment, input.now);
    const next: StoredCommitment = Object.freeze({
      ...previous, state,
      workStartedAt: previous.workStartedAt ?? input.now,
      stateVersion: previous.stateVersion + 1,
    });
    await this.store.saveAtomic({
      previous, next,
      command: succeeded(input.commandKey, "StartWork", requestHash, input.correlationId,
        JSON.stringify({ jobOrderId: input.jobOrderId, stateVersion: next.stateVersion })),
      event: event(input.jobOrderId, "WorkStarted", input.correlationId, input.now, {}),
    });
    return { commitment: next, stage: this.stageOf(next, input.now), replayed: false };
  }

  /**
   * Run the cancellation path.
   *
   * Requestable from any stage, WORK_STARTED included — canon states this as an
   * L7 invariant and again in L11's outcome machine as `Any -> S5`. There is no
   * stage guard here and there must not be one.
   */
  async cancel(input: {
    commandKey: string;
    jobOrderId: string;
    expectedVersion: number;
    request: CancellationRequest;
    ports: ReschedulePorts;
    correlationId: string;
    now: string;
  }): Promise<{ outcome: CancellationOutcome; commitment: StoredCommitment; replayed: boolean }> {
    const requestHash = await sha256Stable({
      type: "RequestCancellation", jobOrderId: input.jobOrderId,
      request: input.request, correlationId: input.correlationId,
    });
    const replayed = await this.replay(input.commandKey, requestHash);
    const previous = await this.require(input.jobOrderId);
    if (replayed) {
      throw new CommitmentServiceError(
        "CANCELLATION_ALREADY_RUN",
        `cancellation ${input.commandKey} already ran for ${input.jobOrderId}; read the stored outcome rather than re-running it`,
      );
    }
    this.checkVersion(previous, input.expectedVersion);

    const outcome = requestCancellation({
      state: previous.state,
      request: input.request,
      ports: { policy: this.config.commitment, ...input.ports },
      now: input.now,
    });

    const next: StoredCommitment = Object.freeze({
      ...previous,
      state: outcome.commitment,
      stateVersion: previous.stateVersion + 1,
    });
    await this.store.saveAtomic({
      previous, next,
      command: succeeded(input.commandKey, "RequestCancellation", requestHash, input.correlationId,
        JSON.stringify({ jobOrderId: input.jobOrderId, resolvedByReschedule: outcome.resolvedByReschedule !== null })),
      event: event(input.jobOrderId, "CancellationRequested", input.correlationId, input.now,
        { steps: outcome.steps, cause: input.request.cause }),
    });
    return { outcome, commitment: next, replayed: false };
  }

  /** The stage as of now, recomputed. Never read a stored stage for this. */
  stageOf(commitment: StoredCommitment, now: string): CommitmentStage {
    return currentStage(commitment.state, this.config.commitment, now);
  }

  async read(jobOrderId: string): Promise<StoredCommitment | null> {
    return this.store.get(jobOrderId);
  }

  // -------------------------------------------------------------------------

  private async require(jobOrderId: string): Promise<StoredCommitment> {
    const found = await this.store.get(jobOrderId);
    if (!found) throw new CommitmentServiceError("NO_COMMITMENT", `no commitment for ${jobOrderId}`);
    return found;
  }

  private checkVersion(commitment: StoredCommitment, expected: number): void {
    if (commitment.stateVersion !== expected) {
      throw new CommitmentServiceError(
        "STALE_VERSION",
        `commitment ${commitment.state.jobOrderId} is at version ${commitment.stateVersion}, command expected ${expected}`,
      );
    }
  }

  private async replay(commandKey: string, requestHash: string): Promise<boolean> {
    const prior = await this.store.getCommand(commandKey);
    if (!prior || prior.status !== "SUCCEEDED") return false;
    if (prior.requestHash !== requestHash) {
      throw new CommitmentServiceError(
        "KEY_REUSED",
        `idempotency key ${commandKey} reused with different commitment input`,
      );
    }
    return true;
  }
}

export class CommitmentServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CommitmentServiceError";
  }
}

function succeeded(
  commandKey: string, commandType: string, requestHash: string,
  correlationId: string, result: string,
): StoredCommand {
  return { commandKey, commandType, requestHash, status: "SUCCEEDED", result, correlationId };
}

function event(
  jobOrderId: string, eventType: CommitmentEvent["eventType"],
  correlationId: string, occurredAt: string, payload: unknown,
): CommitmentEvent {
  return { jobOrderId, eventType, payload: JSON.stringify(payload), correlationId, occurredAt };
}
