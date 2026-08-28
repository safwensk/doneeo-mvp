/**
 * Persistence contract for L09A and L09B.
 *
 * Observations, changed facts and classifications are appended, never updated.
 * P2 requires provenance that survives: a dispute six weeks after the job has
 * to see what was believed at planning time, and a superseded value that was
 * overwritten cannot show that. The store interface has no update method for
 * them, so the constraint is structural rather than a convention.
 */

import type {
  RealityCase, FieldObservation, ChangedFact, ImpactClassification,
} from "../layers/l09a/reality";
import type { RecoveryDecision } from "../layers/l09a/recovery";
import type { ResponsibilityAssessment } from "../layers/l09b/responsibility";
import type { AdjustmentInstruction } from "../layers/l09b/allocation";
import type { StoredCommand } from "./requirement-contract-store";

export type StoredRealityCase = {
  readonly realityCase: RealityCase;
  readonly stateVersion: number;
};

export type RealityEvent = {
  readonly realityCaseId: string;
  readonly jobOrderId: string;
  readonly eventType:
    | "RealityCaseOpened" | "ObservationRecorded" | "ScopeHeld"
    | "RecoveryDecided" | "CaseUnrecoverable"
    | "ResponsibilityAssessed" | "AdjustmentIssued";
  readonly payload: string;
  readonly correlationId: string;
  readonly occurredAt: string;
};

export interface RealityStore {
  get(realityCaseId: string): Promise<StoredRealityCase | null>;
  findOpenByJobOrder(jobOrderId: string): Promise<StoredRealityCase | null>;
  getCommand(commandKey: string): Promise<StoredCommand | null>;

  openAtomic(input: {
    stored: StoredRealityCase;
    command: StoredCommand;
    event: RealityEvent;
  }): Promise<void>;

  /**
   * Append one observation, its changed facts and its classification.
   *
   * All three or none — a classification whose observation did not persist is
   * an unexplained decision, which is the thing DecisionTrace exists to prevent.
   */
  appendObservationAtomic(input: {
    previous: StoredRealityCase;
    next: StoredRealityCase;
    observation: FieldObservation;
    changedFacts: readonly ChangedFact[];
    classification: ImpactClassification;
    classifierName: string;
    command: StoredCommand;
    event: RealityEvent;
  }): Promise<void>;

  saveRecoveryAtomic(input: {
    previous: StoredRealityCase;
    next: StoredRealityCase;
    decision: RecoveryDecision;
    command: StoredCommand;
    event: RealityEvent;
  }): Promise<void>;

  /**
   * Store the assessment and, when there is one, the instruction it produced.
   *
   * `instruction` is absent when the case went to review — and that is the
   * point: a reviewed case must not carry a pre-computed allocation that
   * someone could mistake for a decision.
   */
  saveSettlementAtomic(input: {
    assessmentId: string;
    instructionId: string | null;
    jobOrderId: string;
    realityCaseId: string | null;
    assessment: ResponsibilityAssessment;
    instruction: AdjustmentInstruction | null;
    policyName: string;
    command: StoredCommand;
    event: RealityEvent;
    now: string;
  }): Promise<void>;

  getAssessment(assessmentId: string): Promise<{
    assessment: ResponsibilityAssessment;
    instruction: AdjustmentInstruction | null;
  } | null>;
}
