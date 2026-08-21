import type { PlannerAnalysis } from "../planner";
import {
  ContractInvariantError,
  carryLifecycleForward,
  draftContract,
  initializeLifecycle,
  publish,
  referenceTo,
  supersede,
  type RequirementContract,
  type TaskBlockLifecycleIdentity,
} from "../requirement-contract";
import { markRequirementReady, type WorkCaseControlState } from "../work-case";
import { buildTaskAcceptanceProjections } from "./requirement-contract-projection";
import {
  fingerprintTaskBlocks,
  sha256Stable,
  type TaskBlockAcceptanceProjection,
} from "./requirement-contract-hashing";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1-requirement-contract-store";
import type {
  RequirementContractStore,
  StoredCommand,
} from "./requirement-contract-store";
import {
  IdempotencyKeyReuseError,
  type RequirementContractApplicationResult,
} from "./requirement-contract-service";
import type { WorkCaseStore } from "./work-case-store";
import type { WorkCaseService } from "./work-case-service";

type WorkCaseApplicationPort = Pick<
  WorkCaseService,
  "recordArchitecture" | "requirementReady"
>;

type WorkCasePersistencePort = Pick<
  WorkCaseStore,
  "get" | "getCommand"
>;

type PreparedRequirement = {
  result: RequirementContractApplicationResult;
  statements: D1PreparedStatementLike[];
};

export type D1IntelligenceControlResult = {
  workCaseId: string;
  jobOrderId: string;
  state: string;
  stateVersion: number;
  currentLayerId: WorkCaseControlState["currentLayerId"];
  requirementReady: boolean;
  requirementContract: RequirementContractApplicationResult | null;
};

/**
 * D1-specific transaction coordinator for the exact boundary where a newly
 * published/superseded Requirement Contract becomes current on a WorkCase.
 *
 * Architecture persistence happens first. If requirements are ready and a
 * Requirement Contract write is needed, contract history + lifecycle + event +
 * command and the WorkCase REQUIREMENT_READY pointer + event + command are
 * committed in one D1 batch. There is no interval where a new published
 * contract exists without the corresponding WorkCase pointer.
 */
export class D1IntelligenceControlService {
  constructor(
    private readonly db: D1DatabaseLike,
    private readonly workCases: WorkCaseApplicationPort,
    private readonly workCaseStore: WorkCasePersistencePort,
    private readonly requirements: RequirementContractStore,
  ) {}

  async acceptAnalysis(input: {
    workCaseId: string;
    expectedWorkCaseVersion: number;
    analysis: PlannerAnalysis;
    confirmedAnswers?: Readonly<Record<string, string | boolean>>;
    correlationId: string;
    commandKey: string;
    now: string;
  }): Promise<D1IntelligenceControlResult> {
    const intelligence = input.analysis.intelligence;
    if (!intelligence) {
      throw new Error("Job Intelligence is required before control-plane persistence");
    }

    const recorded = await this.workCases.recordArchitecture({
      commandKey: `${input.commandKey}:architecture`,
      workCaseId: input.workCaseId,
      expectedVersion: input.expectedWorkCaseVersion,
      taskCandidates: intelligence.workstreams.map(stream => ({
        title: stream.title,
        domain: stream.domain,
        ordinal: stream.sequence,
      })),
      confirmedAnswers: input.confirmedAnswers,
      latestAnalysis: input.analysis,
      correlationId: input.correlationId,
      now: input.now,
    });

    const isReady =
      intelligence.estimate.ready &&
      intelligence.unresolved.length === 0 &&
      input.analysis.rulesGate?.status === "cleared";

    if (!isReady) {
      return this.result(recorded.workCase, false, null);
    }

    const projections = buildTaskAcceptanceProjections(
      input.analysis,
      recorded.tasks,
    );

    const requirement = await this.prepareRequirement({
      jobOrderId: recorded.workCase.jobOrderId,
      content: intelligence,
      taskBlocks: projections,
      correlationId: input.correlationId,
      commandKey: `${input.commandKey}:requirement`,
      now: input.now,
    });

    const readyCommandKey = `${input.commandKey}:ready`;
    const priorReady = await this.workCaseStore.getCommand(readyCommandKey);

    // Exact operation retry after the combined batch already committed.
    if (priorReady) {
      const current = await this.workCaseStore.get(recorded.workCase.workCaseId);
      if (
        priorReady.correlationId !== input.correlationId ||
        !current ||
        current.current.requirementContractRef !== requirement.result.reference
      ) {
        throw new IdempotencyKeyReuseError(readyCommandKey);
      }
      return this.result(current, true, requirement.result);
    }

    // No Requirement Contract write is needed for an identical requirement
    // snapshot or for recovery of a previously durable contract. Only the
    // WorkCase pointer remains, so the existing WorkCase atomic boundary is
    // sufficient.
    if (requirement.statements.length === 0) {
      const ready = await this.workCases.requirementReady({
        commandKey: readyCommandKey,
        workCaseId: recorded.workCase.workCaseId,
        expectedVersion: recorded.workCase.stateVersion,
        requirementContractRef: requirement.result.reference,
        correlationId: input.correlationId,
        now: input.now,
      });
      return this.result(ready.workCase, true, requirement.result);
    }

    const next = markRequirementReady(recorded.workCase, {
      expectedVersion: recorded.workCase.stateVersion,
      requirementContractRef: requirement.result.reference,
      now: input.now,
    });

    const readyHash = await sha256Stable({
      type: "MarkRequirementReady",
      workCaseId: recorded.workCase.workCaseId,
      expectedVersion: recorded.workCase.stateVersion,
      requirementContractRef: requirement.result.reference,
      correlationId: input.correlationId,
    });

    const readyCommand: StoredCommand = {
      commandKey: readyCommandKey,
      commandType: "MarkRequirementReady",
      requestHash: readyHash,
      status: "SUCCEEDED",
      result: JSON.stringify({
        workCaseId: next.workCaseId,
        stateVersion: next.stateVersion,
      }),
      correlationId: input.correlationId,
    };

    const readyEvent = {
      streamId: `work-case:${next.workCaseId}`,
      sequence: next.stateVersion,
      eventType: "WorkCaseRequirementReady",
      payload: JSON.stringify({
        requirementContractRef: requirement.result.reference,
      }),
      correlationId: input.correlationId,
      causationId: readyCommandKey,
      occurredAt: input.now,
    };

    const readyStatements = this.workCaseReadyStatements(
      recorded.workCase,
      next,
      readyCommand,
      readyEvent,
    );

    // The first ready statement is a constraint-backed optimistic-concurrency
    // guard. If the WorkCase version changed after architecture persistence,
    // correlation_id becomes NULL and the NOT NULL constraint aborts the whole
    // D1 batch. D1 batch failure rolls back the Requirement Contract writes too.
    await this.db.batch([
      readyStatements[0],
      ...requirement.statements,
      ...readyStatements.slice(1),
    ]);

    return this.result(next, true, requirement.result);
  }

  private result(
    workCase: WorkCaseControlState,
    requirementReady: boolean,
    requirementContract: RequirementContractApplicationResult | null,
  ): D1IntelligenceControlResult {
    return {
      workCaseId: workCase.workCaseId,
      jobOrderId: workCase.jobOrderId,
      state: workCase.state,
      stateVersion: workCase.stateVersion,
      currentLayerId: workCase.currentLayerId,
      requirementReady,
      requirementContract,
    };
  }

  private async prepareRequirement(input: {
    jobOrderId: string;
    content: NonNullable<PlannerAnalysis["intelligence"]>;
    taskBlocks: readonly TaskBlockAcceptanceProjection[];
    correlationId: string;
    commandKey: string;
    now: string;
  }): Promise<PreparedRequirement> {
    const taskBlocks = await fingerprintTaskBlocks(input.taskBlocks);
    const contentHash = await sha256Stable(input.content);
    const current = await this.requirements.getCurrent(input.jobOrderId);

    if (!current) {
      const requestHash = await sha256Stable({
        commandType: "PublishRequirementContract",
        contractId: input.jobOrderId,
        contentHash,
        taskBlocks,
        correlationId: input.correlationId,
      });

      const replay = await this.replayRequirement(
        input.commandKey,
        requestHash,
      );
      if (replay) return { result: replay, statements: [] };

      const draft = draftContract({
        contractId: input.jobOrderId,
        content: input.content,
        correlationId: input.correlationId,
        taskBlocks,
      });
      const contract = publish(draft, {
        publishedAt: input.now,
        contentHash,
      });
      const lifecycle = initializeLifecycle(contract);
      const reference = referenceTo(contract);
      const command = succeededCommand(
        input.commandKey,
        "PublishRequirementContract",
        requestHash,
        input.correlationId,
        reference,
      );

      return {
        result: {
          contract,
          lifecycle: [...lifecycle],
          reference,
          replayed: false,
          changed: true,
        },
        statements: this.publishStatements(
          contract,
          lifecycle,
          command,
          {
            streamId: `requirement-contract:${contract.contractId}`,
            sequence: contract.version,
            eventType: "RequirementContractPublished",
            payload: JSON.stringify({
              reference,
              contentHash,
              requirementIds: contract.taskBlocks.map(
                block => block.requirementId,
              ),
            }),
            correlationId: input.correlationId,
            causationId: input.commandKey,
            occurredAt: input.now,
          },
        ),
      };
    }

    const previousLifecycle = await this.requirements.getLifecycle(
      current.contractId,
      current.version,
    );

    const requestHash = await sha256Stable({
      commandType: "SupersedeRequirementContract",
      baseReference: referenceTo(current),
      contentHash,
      taskBlocks,
      reason: "controlled Intelligence reanalysis",
      correlationId: input.correlationId,
    });

    const replay = await this.replayRequirement(
      input.commandKey,
      requestHash,
    );
    if (replay) return { result: replay, statements: [] };

    let transition: ReturnType<typeof supersede>;
    try {
      transition = supersede({
        previous: current,
        content: input.content,
        contentHash,
        reason: "controlled Intelligence reanalysis",
        correlationId: input.correlationId,
        taskBlocks,
        publishedAt: input.now,
      });
    } catch (error) {
      if (
        error instanceof ContractInvariantError &&
        error.invariant === "NO_MATERIAL_CHANGE"
      ) {
        return {
          result: {
            contract: current,
            lifecycle: previousLifecycle,
            reference: referenceTo(current),
            replayed: false,
            changed: false,
          },
          statements: [],
        };
      }
      throw error;
    }

    const lifecycle = carryLifecycleForward(
      previousLifecycle,
      transition.next,
    );
    const reference = referenceTo(transition.next);
    const command = succeededCommand(
      input.commandKey,
      "SupersedeRequirementContract",
      requestHash,
      input.correlationId,
      reference,
    );

    return {
      result: {
        contract: transition.next,
        lifecycle: [...lifecycle],
        reference,
        replayed: false,
        changed: true,
      },
      statements: this.supersedeStatements(
        transition.superseded,
        transition.next,
        lifecycle,
        command,
        {
          streamId: `requirement-contract:${transition.next.contractId}`,
          sequence: transition.next.version,
          eventType: "RequirementContractSuperseded",
          payload: JSON.stringify({
            previousReference: referenceTo(transition.superseded),
            nextReference: reference,
            reason: "controlled Intelligence reanalysis",
          }),
          correlationId: input.correlationId,
          causationId: input.commandKey,
          occurredAt: input.now,
        },
      ),
    };
  }

  private async replayRequirement(
    commandKey: string,
    requestHash: string,
  ): Promise<RequirementContractApplicationResult | null> {
    const prior = await this.requirements.getCommand(commandKey);
    if (!prior) return null;
    if (prior.requestHash !== requestHash) {
      throw new IdempotencyKeyReuseError(commandKey);
    }
    if (prior.status !== "SUCCEEDED" || !prior.result) return null;

    const parsed = JSON.parse(prior.result) as { reference?: string };
    if (!parsed.reference) {
      throw new Error(
        `Stored Requirement Contract command ${commandKey} has no reference`,
      );
    }

    const at = parsed.reference.lastIndexOf("@");
    const contractId = parsed.reference.slice(0, at);
    const version = Number(parsed.reference.slice(at + 1));
    const contract = await this.requirements.getVersion(contractId, version);
    if (!contract) {
      throw new Error(
        `Idempotency record ${commandKey} points to missing contract ${parsed.reference}`,
      );
    }

    const lifecycle = await this.requirements.getLifecycle(
      contractId,
      version,
    );

    return {
      contract,
      lifecycle,
      reference: parsed.reference,
      replayed: true,
      changed: true,
    };
  }

  private publishStatements(
    contract: RequirementContract,
    lifecycle: readonly TaskBlockLifecycleIdentity[],
    command: StoredCommand,
    event: {
      streamId: string;
      sequence: number;
      eventType: string;
      payload: string;
      correlationId: string;
      causationId: string;
      occurredAt: string;
    },
  ): D1PreparedStatementLike[] {
    const now = contract.publishedAt!;
    return [
      this.insertCommand(command, now),
      this.db.prepare(
        `INSERT INTO requirement_contracts
         (contract_id, version, status, content, content_hash, published_at, superseded_by, supersede_reason, correlation_id, created_at)
         VALUES (?, ?, 'PUBLISHED', ?, ?, ?, NULL, NULL, ?, ?)`,
      ).bind(
        contract.contractId,
        contract.version,
        JSON.stringify(contract.content),
        contract.contentHash,
        contract.publishedAt,
        contract.correlationId,
        now,
      ),
      ...lifecycle.map(item => this.insertLifecycle(item, now)),
      this.insertEvent(event),
      this.finishCommand(command, now),
    ];
  }

  private supersedeStatements(
    previous: RequirementContract,
    next: RequirementContract,
    lifecycle: readonly TaskBlockLifecycleIdentity[],
    command: StoredCommand,
    event: {
      streamId: string;
      sequence: number;
      eventType: string;
      payload: string;
      correlationId: string;
      causationId: string;
      occurredAt: string;
    },
  ): D1PreparedStatementLike[] {
    const now = next.publishedAt!;
    return [
      this.insertCommand(command, now),
      this.db.prepare(
        `UPDATE requirement_contracts
         SET status = 'SUPERSEDED', superseded_by = ?, supersede_reason = ?
         WHERE contract_id = ? AND version = ? AND status = 'PUBLISHED'`,
      ).bind(
        next.version,
        previous.supersedeReason,
        previous.contractId,
        previous.version,
      ),
      this.db.prepare(
        `INSERT INTO requirement_contracts
         (contract_id, version, status, content, content_hash, published_at, superseded_by, supersede_reason, correlation_id, created_at)
         VALUES (?, ?, 'PUBLISHED', ?, ?, ?, NULL, NULL, ?, ?)`,
      ).bind(
        next.contractId,
        next.version,
        JSON.stringify(next.content),
        next.contentHash,
        next.publishedAt,
        next.correlationId,
        now,
      ),
      ...lifecycle.map(item => this.insertLifecycle(item, now)),
      this.insertEvent(event),
      this.finishCommand(command, now),
    ];
  }

  private workCaseReadyStatements(
    previous: WorkCaseControlState,
    next: WorkCaseControlState,
    command: StoredCommand,
    event: {
      streamId: string;
      sequence: number;
      eventType: string;
      payload: string;
      correlationId: string;
      causationId: string;
      occurredAt: string;
    },
  ): D1PreparedStatementLike[] {
    return [
      this.insertGuardedReadyCommand(command, previous, next.updatedAt),
      this.db.prepare(
        `UPDATE work_cases SET state = ?, state_version = ?, current_layer_id = ?, current_requirement_ref = ?, current_fulfillment_ref = ?,
         current_execution_ref = ?, current_outcome_ref = ?, updated_at = ?
         WHERE work_case_id = ? AND state_version = ?`,
      ).bind(
        next.state,
        next.stateVersion,
        next.currentLayerId,
        next.current.requirementContractRef,
        next.current.fulfillmentPlanRef,
        next.current.executionSnapshotRef,
        next.current.outcomeRef,
        next.updatedAt,
        next.workCaseId,
        previous.stateVersion,
      ),
      this.insertEvent(event),
      this.finishCommand(command, next.updatedAt),
    ];
  }

  private insertLifecycle(
    item: TaskBlockLifecycleIdentity,
    now: string,
  ): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO task_block_identities
       (contract_id, contract_version, requirement_id, acceptance_fingerprint, fulfillment_id, execution_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      item.contractId,
      item.contractVersion,
      item.requirementId,
      item.acceptanceFingerprint,
      item.fulfillmentId,
      item.executionId,
      now,
    );
  }

  private insertGuardedReadyCommand(
    command: StoredCommand,
    previous: WorkCaseControlState,
    now: string,
  ): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO command_log
       (command_key, command_type, request_hash, status, result, correlation_id, created_at, completed_at)
       VALUES (
         ?, ?, ?, 'IN_FLIGHT', NULL,
         (
           SELECT CASE
             WHEN EXISTS (
               SELECT 1 FROM work_cases
               WHERE work_case_id = ? AND state_version = ?
             )
             THEN ?
             ELSE NULL
           END
         ),
         ?, NULL
       )`,
    ).bind(
      command.commandKey,
      command.commandType,
      command.requestHash,
      previous.workCaseId,
      previous.stateVersion,
      command.correlationId,
      now,
    );
  }

  private insertCommand(
    command: StoredCommand,
    now: string,
  ): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO command_log
       (command_key, command_type, request_hash, status, result, correlation_id, created_at, completed_at)
       VALUES (?, ?, ?, 'IN_FLIGHT', NULL, ?, ?, NULL)`,
    ).bind(
      command.commandKey,
      command.commandType,
      command.requestHash,
      command.correlationId,
      now,
    );
  }

  private finishCommand(
    command: StoredCommand,
    now: string,
  ): D1PreparedStatementLike {
    return this.db.prepare(
      `UPDATE command_log SET status = 'SUCCEEDED', result = ?, completed_at = ?
       WHERE command_key = ? AND request_hash = ? AND status = 'IN_FLIGHT'`,
    ).bind(command.result, now, command.commandKey, command.requestHash);
  }

  private insertEvent(event: {
    streamId: string;
    sequence: number;
    eventType: string;
    payload: string;
    correlationId: string;
    causationId: string;
    occurredAt: string;
  }): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO domain_events
       (stream_id, sequence, event_type, payload, correlation_id, causation_id, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      event.streamId,
      event.sequence,
      event.eventType,
      event.payload,
      event.correlationId,
      event.causationId,
      event.occurredAt,
    );
  }
}

function succeededCommand(
  commandKey: string,
  commandType: string,
  requestHash: string,
  correlationId: string,
  reference: string,
): StoredCommand {
  return {
    commandKey,
    commandType,
    requestHash,
    status: "SUCCEEDED",
    result: JSON.stringify({ reference }),
    correlationId,
  };
}
