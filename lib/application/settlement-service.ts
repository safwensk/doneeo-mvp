/**
 * L09B in the running system.
 *
 * Takes the eligible costs L7 measured, assesses responsibility, and issues an
 * adjustment instruction — or refuses to, and refers the case to review.
 *
 * WHAT THIS FILE MUST NEVER DO
 *
 * Price anything. The instruction it stores holds minutes and references. L6
 * owns price and L12 posts the ledger; if a currency field appears here, three
 * layer boundaries have been crossed at once. A test greps for it.
 */

import {
  assessResponsibility, FairnessInvariantError,
  type ResponsibilityAssessment, type Cause, type ReviewPolicy,
  type CustomerFactTest, type ProviderPerformanceTest, type DoneeoControlTest,
} from "../layers/l09b/responsibility";
import { allocate, protectedProviderPayable, type AdjustmentInstruction } from "../layers/l09b/allocation";
import type { EligibleCost } from "../layers/l7/cancellation";
import type { RealityStore, RealityEvent } from "./reality-store";
import type { StoredCommand } from "./requirement-contract-store";
import { sha256Stable } from "./requirement-contract-hashing";

export type ReviewPolicyConfig = {
  readonly name: string;
  readonly review: ReviewPolicy;
};

export type SettlementResult = {
  readonly assessmentId: string;
  readonly assessment: ResponsibilityAssessment;
  /** Null when the case went to review. A reviewed case carries no allocation. */
  readonly instruction: AdjustmentInstruction | null;
  readonly instructionId: string | null;
  readonly replayed: boolean;
};

export class SettlementService {
  constructor(
    private readonly store: RealityStore,
    private readonly config: ReviewPolicyConfig,
  ) {}

  /**
   * Assess and, where the case is clear, allocate.
   *
   * The two steps are not merged because they fail differently: an assessment
   * that requires review is a valid, complete answer, while an allocation of a
   * case requiring review is an error the layer refuses to produce.
   */
  async settle(input: {
    commandKey: string;
    assessmentId: string;
    jobOrderId: string;
    realityCaseId: string | null;
    cause: Cause;
    customerTest: CustomerFactTest;
    providerTest: ProviderPerformanceTest;
    doneeoTest: DoneeoControlTest;
    disputed: boolean;
    evidenceRefs: readonly string[];
    eligibleCosts: readonly EligibleCost[];
    recoveryCredit?: readonly EligibleCost[];
    correlationId: string;
    now: string;
  }): Promise<SettlementResult> {
    const requestHash = await sha256Stable({
      type: "SettleResponsibility", jobOrderId: input.jobOrderId,
      cause: input.cause, eligibleCosts: input.eligibleCosts,
      correlationId: input.correlationId,
    });
    if (await this.replay(input.commandKey, requestHash)) {
      const prior = await this.store.getAssessment(input.assessmentId);
      if (!prior) {
        throw new SettlementServiceError(
          "REPLAY_WITHOUT_RECORD",
          `command ${input.commandKey} succeeded before but assessment ${input.assessmentId} is not stored`,
        );
      }
      return {
        assessmentId: input.assessmentId, assessment: prior.assessment,
        instruction: prior.instruction,
        instructionId: prior.instruction ? `ADJ-${input.assessmentId}` : null,
        replayed: true,
      };
    }

    const assessment = assessResponsibility({
      realityCaseId: input.realityCaseId ?? input.jobOrderId,
      cause: input.cause,
      customerTest: input.customerTest,
      providerTest: input.providerTest,
      doneeoTest: input.doneeoTest,
      disputed: input.disputed,
      evidenceRefs: input.evidenceRefs,
      policy: this.config.review,
    });

    // A case that needs a person is stored WITHOUT an instruction. Storing a
    // provisional allocation next to it would let someone read a decision that
    // was never made.
    let instruction: AdjustmentInstruction | null = null;
    let instructionId: string | null = null;
    if (!assessment.requiresReview) {
      instruction = allocate({
        assessment,
        eligibleCosts: input.eligibleCosts,
        recoveryCredit: input.recoveryCredit,
      });
      instructionId = `ADJ-${input.assessmentId}`;
    }

    await this.store.saveSettlementAtomic({
      assessmentId: input.assessmentId,
      instructionId,
      jobOrderId: input.jobOrderId,
      realityCaseId: input.realityCaseId,
      assessment,
      instruction,
      policyName: this.config.name,
      command: succeeded(input.commandKey, "SettleResponsibility", requestHash, input.correlationId,
        JSON.stringify({ assessmentId: input.assessmentId, requiresReview: assessment.requiresReview })),
      event: evt(input.realityCaseId ?? input.jobOrderId, input.jobOrderId,
        assessment.requiresReview ? "ResponsibilityAssessed" : "AdjustmentIssued",
        input.correlationId, input.now,
        { cause: input.cause, requiresReview: assessment.requiresReview }),
      now: input.now,
    });

    return { assessmentId: input.assessmentId, assessment, instruction, instructionId, replayed: false };
  }

  /**
   * What the provider is owed for what they actually did.
   *
   * Answerable on its own, and deliberately so: protection follows performance,
   * not fault, so a provider can be made whole while the question of who bears
   * it is still open in review.
   */
  providerProtection(input: {
    assessment: ResponsibilityAssessment;
    eligibleCosts: readonly EligibleCost[];
  }) {
    return protectedProviderPayable(input);
  }

  async read(assessmentId: string) {
    return this.store.getAssessment(assessmentId);
  }

  // -------------------------------------------------------------------------

  private async replay(commandKey: string, requestHash: string): Promise<boolean> {
    const prior = await this.store.getCommand(commandKey);
    if (!prior || prior.status !== "SUCCEEDED") return false;
    if (prior.requestHash !== requestHash) {
      throw new SettlementServiceError("KEY_REUSED", `idempotency key ${commandKey} reused with different settlement input`);
    }
    return true;
  }
}

export class SettlementServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SettlementServiceError";
  }
}

export { FairnessInvariantError };

function succeeded(
  commandKey: string, commandType: string, requestHash: string,
  correlationId: string, result: string,
): StoredCommand {
  return { commandKey, commandType, requestHash, status: "SUCCEEDED", result, correlationId };
}

function evt(
  realityCaseId: string, jobOrderId: string, eventType: RealityEvent["eventType"],
  correlationId: string, occurredAt: string, payload: unknown,
): RealityEvent {
  return { realityCaseId, jobOrderId, eventType, payload: JSON.stringify(payload), correlationId, occurredAt };
}
