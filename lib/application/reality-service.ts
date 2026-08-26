/**
 * L09A in the running system.
 *
 * Opens a RealityCase when the site disagrees with the plan, appends what was
 * observed, and runs the fastest-safe-solution search. It does not decide who
 * pays — that is L09B, reached through SettlementService, and the separation is
 * the reason there is no responsibility vocabulary anywhere in this file.
 */

import {
  openRealityCase, recordObservation, RealityInvariantError,
  type RealityCase, type FieldObservation, type ChangedFact, type FieldMSI,
  type ImpactClassifier,
} from "../layers/l09a/reality";
import {
  decideRecovery, markUnrecoverable, candidateFollowUpFrom,
  type RecoveryDecision, type RecoverySearch, type CandidateFollowUp,
} from "../layers/l09a/recovery";
import type { RealityStore, StoredRealityCase, RealityEvent } from "./reality-store";
import type { StoredCommand } from "./requirement-contract-store";
import { sha256Stable } from "./requirement-contract-hashing";

export type ClassifierConfig = {
  readonly name: string;
  readonly classifier: ImpactClassifier;
};

export class RealityService {
  constructor(
    private readonly store: RealityStore,
    private readonly config: ClassifierConfig,
  ) {}

  /** One open case per job. A second disruption joins the case, not a new one. */
  async open(input: {
    commandKey: string;
    realityCaseId: string;
    workCaseId: string;
    jobOrderId: string;
    correlationId: string;
    now: string;
  }): Promise<{ stored: StoredRealityCase; replayed: boolean }> {
    const requestHash = await sha256Stable({
      type: "OpenRealityCase", jobOrderId: input.jobOrderId,
      realityCaseId: input.realityCaseId, correlationId: input.correlationId,
    });
    if (await this.replay(input.commandKey, requestHash)) {
      return { stored: await this.require(input.realityCaseId), replayed: true };
    }
    const existing = await this.store.findOpenByJobOrder(input.jobOrderId);
    if (existing) {
      throw new RealityServiceError(
        "CASE_ALREADY_OPEN",
        `${input.jobOrderId} already has open RealityCase ${existing.realityCase.realityCaseId}; ` +
        "a second disruption is another observation on the same case",
      );
    }

    const stored: StoredRealityCase = Object.freeze({
      realityCase: openRealityCase({
        realityCaseId: input.realityCaseId, workCaseId: input.workCaseId,
        jobOrderId: input.jobOrderId, now: input.now,
      }),
      stateVersion: 1,
    });
    await this.store.openAtomic({
      stored,
      command: succeeded(input.commandKey, "OpenRealityCase", requestHash, input.correlationId,
        JSON.stringify({ realityCaseId: input.realityCaseId })),
      event: evt(input.realityCaseId, input.jobOrderId, "RealityCaseOpened", input.correlationId, input.now, {}),
    });
    return { stored, replayed: false };
  }

  /**
   * Append an observation and classify it.
   *
   * An R4 classification holds the affected TaskBlock inside the layer, before
   * this method returns — the hold is not something the caller can forget to
   * apply. Which is why the event emitted is ScopeHeld rather than a plain
   * ObservationRecorded when that happens.
   */
  async observe(input: {
    commandKey: string;
    realityCaseId: string;
    expectedVersion: number;
    observation: FieldObservation;
    changedFacts: readonly ChangedFact[];
    fieldMSI?: readonly FieldMSI[];
    plannedStatement: string;
    correlationId: string;
    now: string;
  }): Promise<{ stored: StoredRealityCase; heldNow: boolean; replayed: boolean }> {
    // expectedVersion is a precondition, not identity.
    const requestHash = await sha256Stable({
      type: "RecordObservation", realityCaseId: input.realityCaseId,
      observation: input.observation, changedFacts: input.changedFacts,
      correlationId: input.correlationId,
    });
    const replayed = await this.replay(input.commandKey, requestHash);
    const previous = await this.require(input.realityCaseId);
    if (replayed) return { stored: previous, heldNow: false, replayed: true };
    this.checkVersion(previous, input.expectedVersion);

    const realityCase = recordObservation({
      realityCase: previous.realityCase,
      observation: input.observation,
      changedFacts: input.changedFacts,
      fieldMSI: input.fieldMSI,
      plannedStatement: input.plannedStatement,
      classifier: this.config.classifier,
    });

    const classification = realityCase.classifications[realityCase.classifications.length - 1]!;
    const heldNow = realityCase.heldTaskIds.length > previous.realityCase.heldTaskIds.length;
    const next: StoredRealityCase = Object.freeze({
      realityCase, stateVersion: previous.stateVersion + 1,
    });

    await this.store.appendObservationAtomic({
      previous, next,
      observation: input.observation,
      changedFacts: input.changedFacts,
      classification,
      classifierName: this.config.name,
      command: succeeded(input.commandKey, "RecordObservation", requestHash, input.correlationId,
        JSON.stringify({ impact: classification.impact, needsHumanReview: classification.needsHumanReview })),
      event: evt(input.realityCaseId, realityCase.jobOrderId,
        heldNow ? "ScopeHeld" : "ObservationRecorded", input.correlationId, input.now,
        { impact: classification.impact, taskId: input.observation.taskId }),
    });
    return { stored: next, heldNow, replayed: false };
  }

  /**
   * Walk the recovery hierarchy and take the first viable option.
   *
   * The search is a port because what is viable depends on live resource and
   * roster data that this layer must not reach into directly.
   */
  async recover(input: {
    commandKey: string;
    realityCaseId: string;
    expectedVersion: number;
    allTaskIds: readonly string[];
    dependsOn: Readonly<Record<string, readonly string[]>>;
    search: RecoverySearch;
    correlationId: string;
    now: string;
  }): Promise<{ decision: RecoveryDecision; stored: StoredRealityCase; replayed: boolean }> {
    const requestHash = await sha256Stable({
      type: "DecideRecovery", realityCaseId: input.realityCaseId,
      allTaskIds: input.allTaskIds, correlationId: input.correlationId,
    });
    const replayed = await this.replay(input.commandKey, requestHash);
    const previous = await this.require(input.realityCaseId);
    if (replayed) {
      throw new RealityServiceError(
        "RECOVERY_ALREADY_DECIDED",
        `recovery ${input.commandKey} already ran; read the stored decision rather than re-deciding`,
      );
    }
    this.checkVersion(previous, input.expectedVersion);

    const decision = decideRecovery({
      realityCase: previous.realityCase,
      allTaskIds: input.allTaskIds,
      dependsOn: input.dependsOn,
      search: input.search,
    });

    // No safe or viable option: L7's cancellation path takes over, which is why
    // L7 consumes RealityCase.Unrecoverable.
    const realityCase: RealityCase = decision.unrecoverable
      ? markUnrecoverable(previous.realityCase)
      : Object.freeze({ ...previous.realityCase, status: "RECOVERING" as const });

    const next: StoredRealityCase = Object.freeze({
      realityCase, stateVersion: previous.stateVersion + 1,
    });
    await this.store.saveRecoveryAtomic({
      previous, next, decision,
      command: succeeded(input.commandKey, "DecideRecovery", requestHash, input.correlationId,
        JSON.stringify({ selected: decision.selected?.kind ?? null, unrecoverable: decision.unrecoverable })),
      event: evt(input.realityCaseId, realityCase.jobOrderId,
        decision.unrecoverable ? "CaseUnrecoverable" : "RecoveryDecided",
        input.correlationId, input.now,
        { selected: decision.selected?.kind ?? null, routeTo: decision.routeTo }),
    });
    return { decision, stored: next, replayed: false };
  }

  /**
   * Independent work noticed on site.
   *
   * Returns a suggestion with no price and no way to execute it. Canon twice:
   * independent observed work never becomes current billable scope without
   * consent, and only L13 may change that.
   */
  async candidateFollowUp(realityCaseId: string, observationId: string): Promise<CandidateFollowUp> {
    const stored = await this.require(realityCaseId);
    return candidateFollowUpFrom(stored.realityCase, observationId);
  }

  async read(realityCaseId: string): Promise<StoredRealityCase | null> {
    return this.store.get(realityCaseId);
  }

  // -------------------------------------------------------------------------

  private async require(realityCaseId: string): Promise<StoredRealityCase> {
    const found = await this.store.get(realityCaseId);
    if (!found) throw new RealityServiceError("NO_CASE", `no RealityCase ${realityCaseId}`);
    return found;
  }

  private checkVersion(stored: StoredRealityCase, expected: number): void {
    if (stored.stateVersion !== expected) {
      throw new RealityServiceError(
        "STALE_VERSION",
        `RealityCase ${stored.realityCase.realityCaseId} is at version ${stored.stateVersion}, command expected ${expected}`,
      );
    }
  }

  private async replay(commandKey: string, requestHash: string): Promise<boolean> {
    const prior = await this.store.getCommand(commandKey);
    if (!prior || prior.status !== "SUCCEEDED") return false;
    if (prior.requestHash !== requestHash) {
      throw new RealityServiceError("KEY_REUSED", `idempotency key ${commandKey} reused with different reality input`);
    }
    return true;
  }
}

export class RealityServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "RealityServiceError";
  }
}

export { RealityInvariantError };

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
