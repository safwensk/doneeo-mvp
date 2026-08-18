import { deepFrozenClone, type RequirementContract, type TaskBlockLifecycleIdentity } from "../requirement-contract";
import type {
  AtomicPublishWrite,
  AtomicSupersedeWrite,
  RequirementContractStore,
  StoredCommand,
} from "./requirement-contract-store";

/** Minimal structural D1 types keep this adapter framework-independent and easy to test. */
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
}

type ContractRow = {
  contract_id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  content: string;
  content_hash: string;
  published_at: string | null;
  superseded_by: number | null;
  supersede_reason: string | null;
  correlation_id: string;
};

type LifecycleRow = {
  contract_id: string;
  contract_version: number;
  requirement_id: string;
  acceptance_fingerprint: string;
  fulfillment_id: string | null;
  execution_id: string | null;
};

type CommandRow = {
  command_key: string;
  command_type: string;
  request_hash: string;
  status: "IN_FLIGHT" | "SUCCEEDED" | "FAILED";
  result: string | null;
  correlation_id: string;
};

export class D1RequirementContractStore implements RequirementContractStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async getCurrent(contractId: string): Promise<RequirementContract | null> {
    const { results } = await this.db.prepare(
      `SELECT contract_id, version, status, content, content_hash, published_at, superseded_by, supersede_reason, correlation_id
       FROM requirement_contracts WHERE contract_id = ? AND status = 'PUBLISHED' ORDER BY version DESC LIMIT 2`,
    ).bind(contractId).all<ContractRow>();
    if (results.length > 1) throw new Error(`Requirement Contract lineage fork: ${contractId} has more than one PUBLISHED version`);
    return results[0] ? this.hydrate(results[0]) : null;
  }

  async getVersion(contractId: string, version: number): Promise<RequirementContract | null> {
    const row = await this.db.prepare(
      `SELECT contract_id, version, status, content, content_hash, published_at, superseded_by, supersede_reason, correlation_id
       FROM requirement_contracts WHERE contract_id = ? AND version = ?`,
    ).bind(contractId, version).first<ContractRow>();
    return row ? this.hydrate(row) : null;
  }

  async getLifecycle(contractId: string, version: number): Promise<TaskBlockLifecycleIdentity[]> {
    const { results } = await this.db.prepare(
      `SELECT contract_id, contract_version, requirement_id, acceptance_fingerprint, fulfillment_id, execution_id
       FROM task_block_identities WHERE contract_id = ? AND contract_version = ? ORDER BY requirement_id`,
    ).bind(contractId, version).all<LifecycleRow>();
    return results.map(row => ({
      contractId: row.contract_id,
      contractVersion: row.contract_version,
      requirementId: row.requirement_id,
      acceptanceFingerprint: row.acceptance_fingerprint,
      fulfillmentId: row.fulfillment_id,
      executionId: row.execution_id,
    }));
  }

  async getCommand(commandKey: string): Promise<StoredCommand | null> {
    const row = await this.db.prepare(
      `SELECT command_key, command_type, request_hash, status, result, correlation_id FROM command_log WHERE command_key = ?`,
    ).bind(commandKey).first<CommandRow>();
    if (!row || row.status === "IN_FLIGHT") return null;
    return {
      commandKey: row.command_key,
      commandType: row.command_type,
      requestHash: row.request_hash,
      status: row.status,
      result: row.result,
      correlationId: row.correlation_id,
    };
  }

  async publishAtomic(write: AtomicPublishWrite): Promise<void> {
    const now = write.contract.publishedAt!;
    const statements = [
      this.insertCommand(write.command, now),
      this.db.prepare(
        `INSERT INTO requirement_contracts
         (contract_id, version, status, content, content_hash, published_at, superseded_by, supersede_reason, correlation_id, created_at)
         VALUES (?, ?, 'PUBLISHED', ?, ?, ?, NULL, NULL, ?, ?)`,
      ).bind(write.contract.contractId, write.contract.version, JSON.stringify(write.contract.content), write.contract.contentHash, write.contract.publishedAt, write.contract.correlationId, now),
      ...write.lifecycle.map(item => this.insertLifecycle(item, now)),
      this.insertEvent(write.event),
      this.finishCommand(write.command, now),
    ];
    await this.db.batch(statements);
  }

  async supersedeAtomic(write: AtomicSupersedeWrite): Promise<void> {
    const now = write.next.publishedAt!;
    const statements = [
      this.insertCommand(write.command, now),
      // This conditional update plus the next-version PK / current-version unique
      // index protects stale writers. Any racing second writer collides and the
      // whole D1 batch rolls back.
      this.db.prepare(
        `UPDATE requirement_contracts
         SET status = 'SUPERSEDED', superseded_by = ?, supersede_reason = ?
         WHERE contract_id = ? AND version = ? AND status = 'PUBLISHED'`,
      ).bind(write.next.version, write.previous.supersedeReason, write.previous.contractId, write.previous.version),
      this.db.prepare(
        `INSERT INTO requirement_contracts
         (contract_id, version, status, content, content_hash, published_at, superseded_by, supersede_reason, correlation_id, created_at)
         VALUES (?, ?, 'PUBLISHED', ?, ?, ?, NULL, NULL, ?, ?)`,
      ).bind(write.next.contractId, write.next.version, JSON.stringify(write.next.content), write.next.contentHash, write.next.publishedAt, write.next.correlationId, now),
      ...write.lifecycle.map(item => this.insertLifecycle(item, now)),
      this.insertEvent(write.event),
      this.finishCommand(write.command, now),
    ];
    await this.db.batch(statements);
  }

  private async hydrate(row: ContractRow): Promise<RequirementContract> {
    const lifecycle = await this.getLifecycle(row.contract_id, row.version);
    return deepFrozenClone({
      contractId: row.contract_id,
      version: row.version,
      status: row.status,
      content: JSON.parse(row.content),
      contentHash: row.content_hash,
      publishedAt: row.published_at,
      supersededBy: row.superseded_by,
      supersedeReason: row.supersede_reason,
      correlationId: row.correlation_id,
      taskBlocks: lifecycle.map(item => ({ requirementId: item.requirementId, acceptanceFingerprint: item.acceptanceFingerprint })),
    });
  }

  private insertLifecycle(item: TaskBlockLifecycleIdentity, now: string): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO task_block_identities
       (contract_id, contract_version, requirement_id, acceptance_fingerprint, fulfillment_id, execution_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(item.contractId, item.contractVersion, item.requirementId, item.acceptanceFingerprint, item.fulfillmentId, item.executionId, now);
  }

  private insertCommand(command: StoredCommand, now: string): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO command_log
       (command_key, command_type, request_hash, status, result, correlation_id, created_at, completed_at)
       VALUES (?, ?, ?, 'IN_FLIGHT', NULL, ?, ?, NULL)`,
    ).bind(command.commandKey, command.commandType, command.requestHash, command.correlationId, now);
  }

  private finishCommand(command: StoredCommand, now: string): D1PreparedStatementLike {
    return this.db.prepare(
      `UPDATE command_log SET status = 'SUCCEEDED', result = ?, completed_at = ?
       WHERE command_key = ? AND request_hash = ? AND status = 'IN_FLIGHT'`,
    ).bind(command.result, now, command.commandKey, command.requestHash);
  }

  private insertEvent(event: AtomicPublishWrite["event"]): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO domain_events
       (stream_id, sequence, event_type, payload, correlation_id, causation_id, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(event.streamId, event.sequence, event.eventType, event.payload, event.correlationId, event.causationId, event.occurredAt);
  }
}
