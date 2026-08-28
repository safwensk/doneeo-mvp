/**
 * Persistence contract for L7.
 *
 * The layer itself is pure — it takes a CommitmentState and returns a new one.
 * This is where that state comes from and goes back to. Note what is NOT here:
 * no stage column and no stage argument anywhere. Stage is recomputed from
 * stored facts and the governing policy on every read.
 */

import type {
  CommitmentState, CapacityReservation, PreparationRecord,
} from "../layers/l7/commitment";
import type { StoredCommand } from "./requirement-contract-store";

/**
 * A commitment as stored, plus the facts stage is derived from.
 *
 * `policyName` travels with it because a commitment made under the terms a
 * customer was shown must not be re-interpreted by a later policy.
 */
export type StoredCommitment = {
  readonly state: CommitmentState;
  readonly workCaseId: string | null;
  readonly policyName: string;
  readonly providerAccepted: boolean;
  readonly mobilizationStartedAt: string | null;
  readonly workStartedAt: string | null;
  readonly stateVersion: number;
};

export type CommitmentEvent = {
  readonly jobOrderId: string;
  readonly eventType:
    | "CapacityHeld" | "PreparationRecorded" | "MobilizationStarted"
    | "WorkStarted" | "CommitmentFrozen" | "CancellationRequested";
  readonly payload: string;
  readonly correlationId: string;
  readonly occurredAt: string;
};

export interface CommitmentStore {
  get(jobOrderId: string): Promise<StoredCommitment | null>;
  getCommand(commandKey: string): Promise<StoredCommand | null>;

  /** Create the commitment and its reservations in one transaction. */
  openAtomic(input: {
    commitment: StoredCommitment;
    command: StoredCommand;
    event: CommitmentEvent;
  }): Promise<void>;

  /**
   * Replace the commitment and its reservations.
   *
   * `previous.stateVersion` is the optimistic-concurrency precondition — the
   * write must fail if the stored version has moved. It is NOT part of the
   * command's identity; see the note in commitment-service.
   */
  saveAtomic(input: {
    previous: StoredCommitment;
    next: StoredCommitment;
    preparation?: readonly PreparationRecord[];
    command: StoredCommand;
    event: CommitmentEvent;
  }): Promise<void>;

  /** Accepted assignments for a job, as L4 recorded them. Seeds reservations. */
  acceptedAssignments(jobOrderId: string): Promise<readonly {
    executorId: string; role: string; isLead: boolean;
  }[]>;

  reservations(jobOrderId: string): Promise<readonly CapacityReservation[]>;
}
