import type { JobIntelligence } from "../planner";
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
import { fingerprintTaskBlocks, sha256Stable, type TaskBlockAcceptanceProjection } from "./requirement-contract-hashing";
import type { RequirementContractStore, StoredCommand } from "./requirement-contract-store";

export type RequirementContractApplicationResult = {
  contract: RequirementContract;
  lifecycle: TaskBlockLifecycleIdentity[];
  reference: string;
  replayed: boolean;
  changed: boolean;
};

export type PublishRequirementContractCommand = {
  commandKey: string;
  contractId: string;
  content: JobIntelligence;
  correlationId: string;
  taskBlocks: readonly TaskBlockAcceptanceProjection[];
  publishedAt: string;
};

export type SupersedeRequirementContractCommand = {
  commandKey: string;
  contractId: string;
  content: JobIntelligence;
  correlationId: string;
  taskBlocks: readonly TaskBlockAcceptanceProjection[];
  reason: string;
  publishedAt: string;
};

export class IdempotencyKeyReuseError extends Error {
  constructor(readonly commandKey: string) {
    super(`idempotency key ${commandKey} was already used for different command input`);
    this.name = "IdempotencyKeyReuseError";
  }
}

export class RequirementContractNotFoundError extends Error {
  constructor(readonly contractId: string) {
    super(`no current Requirement Contract exists for ${contractId}`);
    this.name = "RequirementContractNotFoundError";
  }
}

export class RequirementContractService {
  constructor(private readonly store: RequirementContractStore) {}


  async publishOrSupersede(command: PublishRequirementContractCommand & { reason: string }): Promise<RequirementContractApplicationResult> {
    const current = await this.store.getCurrent(command.contractId);
    if (!current) return this.publish(command);
    return this.supersede({ ...command, reason: command.reason });
  }

  async publish(command: PublishRequirementContractCommand): Promise<RequirementContractApplicationResult> {
    validateCommand(command.commandKey, command.correlationId, command.publishedAt);
    const taskBlocks = await fingerprintTaskBlocks(command.taskBlocks);
    const contentHash = await sha256Stable(command.content);
    const requestHash = await sha256Stable({
      commandType: "PublishRequirementContract",
      contractId: command.contractId,
      contentHash,
      taskBlocks,
      correlationId: command.correlationId,
    });

    const replay = await this.replayIfPresent(command.commandKey, requestHash);
    if (replay) return replay;

    const draft = draftContract({
      contractId: command.contractId,
      content: command.content,
      correlationId: command.correlationId,
      taskBlocks,
    });
    const contract = publish(draft, { publishedAt: command.publishedAt, contentHash });
    const lifecycle = initializeLifecycle(contract);
    const reference = referenceTo(contract);
    const storedCommand = succeededCommand(command.commandKey, "PublishRequirementContract", requestHash, command.correlationId, reference);

    try {
      await this.store.publishAtomic({
        contract,
        lifecycle,
        command: storedCommand,
        event: {
          streamId: streamId(contract.contractId),
          sequence: contract.version,
          eventType: "RequirementContractPublished",
          payload: JSON.stringify({ reference, contentHash, requirementIds: contract.taskBlocks.map(block => block.requirementId) }),
          correlationId: command.correlationId,
          causationId: command.commandKey,
          occurredAt: command.publishedAt,
        },
      });
    } catch (error) {
      const afterRace = await this.replayIfPresent(command.commandKey, requestHash);
      if (afterRace) return afterRace;
      throw error;
    }

    return { contract, lifecycle: [...lifecycle], reference, replayed: false, changed: true };
  }

  async supersede(command: SupersedeRequirementContractCommand): Promise<RequirementContractApplicationResult> {
    validateCommand(command.commandKey, command.correlationId, command.publishedAt);
    if (!command.reason.trim()) throw new ContractInvariantError("SUPERSEDE_REASON", "a supersede reason is required");

    const current = await this.store.getCurrent(command.contractId);
    if (!current) throw new RequirementContractNotFoundError(command.contractId);
    const previousLifecycle = await this.store.getLifecycle(current.contractId, current.version);
    const taskBlocks = await fingerprintTaskBlocks(command.taskBlocks);
    const contentHash = await sha256Stable(command.content);
    const requestHash = await sha256Stable({
      commandType: "SupersedeRequirementContract",
      baseReference: referenceTo(current),
      contentHash,
      taskBlocks,
      reason: command.reason.trim(),
      correlationId: command.correlationId,
    });

    const replay = await this.replayIfPresent(command.commandKey, requestHash);
    if (replay) return replay;

    let transition: ReturnType<typeof supersede>;
    try {
      transition = supersede({
        previous: current,
        content: command.content,
        contentHash,
        reason: command.reason,
        correlationId: command.correlationId,
        taskBlocks,
        publishedAt: command.publishedAt,
      });
    } catch (error) {
      if (error instanceof ContractInvariantError && error.invariant === "NO_MATERIAL_CHANGE") {
        return {
          contract: current,
          lifecycle: previousLifecycle,
          reference: referenceTo(current),
          replayed: false,
          changed: false,
        };
      }
      throw error;
    }

    const lifecycle = carryLifecycleForward(previousLifecycle, transition.next);
    const reference = referenceTo(transition.next);
    const storedCommand = succeededCommand(command.commandKey, "SupersedeRequirementContract", requestHash, command.correlationId, reference);

    try {
      await this.store.supersedeAtomic({
        previous: transition.superseded,
        next: transition.next,
        lifecycle,
        command: storedCommand,
        event: {
          streamId: streamId(transition.next.contractId),
          sequence: transition.next.version,
          eventType: "RequirementContractSuperseded",
          payload: JSON.stringify({
            previousReference: referenceTo(transition.superseded),
            nextReference: reference,
            reason: command.reason.trim(),
            changedRequirementIds: changedRequirementIds(current, transition.next),
          }),
          correlationId: command.correlationId,
          causationId: command.commandKey,
          occurredAt: command.publishedAt,
        },
      });
    } catch (error) {
      const afterRace = await this.replayIfPresent(command.commandKey, requestHash);
      if (afterRace) return afterRace;
      throw error;
    }

    return { contract: transition.next, lifecycle: [...lifecycle], reference, replayed: false, changed: true };
  }

  private async replayIfPresent(commandKey: string, requestHash: string): Promise<RequirementContractApplicationResult | null> {
    const prior = await this.store.getCommand(commandKey);
    if (!prior) return null;
    if (prior.requestHash !== requestHash) throw new IdempotencyKeyReuseError(commandKey);
    if (prior.status !== "SUCCEEDED" || !prior.result) return null;
    const result = JSON.parse(prior.result) as { reference?: string };
    if (!result.reference) throw new Error(`stored idempotency result for ${commandKey} has no contract reference`);
    const { contractId, version } = parseReference(result.reference);
    const contract = await this.store.getVersion(contractId, version);
    if (!contract) throw new Error(`idempotency record ${commandKey} points to missing contract ${result.reference}`);
    const lifecycle = await this.store.getLifecycle(contractId, version);
    return { contract, lifecycle, reference: result.reference, replayed: true, changed: true };
  }
}

function validateCommand(commandKey: string, correlationId: string, publishedAt: string) {
  if (!commandKey.trim()) throw new Error("commandKey is required");
  if (!correlationId.trim()) throw new ContractInvariantError("CORRELATION", "correlationId is required");
  if (!publishedAt.trim()) throw new ContractInvariantError("PUBLISH_TIME", "publishedAt is required");
}

function succeededCommand(commandKey: string, commandType: string, requestHash: string, correlationId: string, reference: string): StoredCommand {
  return { commandKey, commandType, requestHash, status: "SUCCEEDED", result: JSON.stringify({ reference }), correlationId };
}

function streamId(contractId: string) {
  return `requirement-contract:${contractId}`;
}

function changedRequirementIds(previous: RequirementContract, next: RequirementContract): string[] {
  const prior = new Map(previous.taskBlocks.map(block => [block.requirementId, block.acceptanceFingerprint]));
  const nextIds = new Set(next.taskBlocks.map(block => block.requirementId));
  const changed = next.taskBlocks.filter(block => prior.get(block.requirementId) !== block.acceptanceFingerprint).map(block => block.requirementId);
  for (const id of prior.keys()) if (!nextIds.has(id)) changed.push(id);
  return changed;
}

function parseReference(reference: string): { contractId: string; version: number } {
  const at = reference.lastIndexOf("@");
  const version = Number(reference.slice(at + 1));
  if (at < 1 || !Number.isInteger(version) || version < 1) throw new Error(`invalid stored contract reference: ${reference}`);
  return { contractId: reference.slice(0, at), version };
}
