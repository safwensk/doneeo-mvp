/**
 * Requirement Contract — immutable, provider-neutral handoff from Intelligence.
 *
 * Canonical invariants implemented here:
 * - stable identity + monotonic versions;
 * - material requirement changes create a new version;
 * - provider-only changes never mutate the Requirement Contract;
 * - exact contractId@version references resolve forever;
 * - published snapshots are deeply immutable;
 * - requirement / fulfillment / execution lifecycles are separate.
 *
 * Hashing is intentionally NOT implemented in this pure domain module. The
 * application boundary computes SHA-256 over stableStringify(content) and passes
 * the digest into publish/supersede.
 */

import type { JobIntelligence } from "./planner";

export type ContractStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";

/** Provider-neutral identity of one independently reasoned customer outcome. */
export type RequirementTaskBlock = {
  requirementId: string;
  /** SHA-256 of only the fields a provider would actually accept for this task. */
  acceptanceFingerprint: string;
};

/** Downstream lifecycle state. This is deliberately NOT part of the contract. */
export type TaskBlockLifecycleIdentity = {
  contractId: string;
  contractVersion: number;
  requirementId: string;
  acceptanceFingerprint: string;
  fulfillmentId: string | null;
  executionId: string | null;
};

export type RequirementContract = {
  contractId: string;
  version: number;
  status: ContractStatus;
  content: JobIntelligence;
  /** Null only while DRAFT. PUBLISHED/SUPERSEDED must carry a SHA-256 digest. */
  contentHash: string | null;
  publishedAt: string | null;
  supersededBy: number | null;
  supersedeReason: string | null;
  correlationId: string;
  /** Immutable provider-neutral task requirements. */
  taskBlocks: RequirementTaskBlock[];
};

export class ContractInvariantError extends Error {
  readonly invariant: string;
  constructor(invariant: string, message: string) {
    super(message);
    this.name = "ContractInvariantError";
    this.invariant = invariant;
  }
}

/** Deterministic JSON. Object-key order is ignored; array order is significant. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + stableStringify(v)).join(",") + "}";
}

/** Clone JSON-like domain data and recursively freeze the clone. */
export function deepFrozenClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map(item => deepFrozenClone(item))) as unknown as T;
  }
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = deepFrozenClone(child);
  }
  return Object.freeze(output) as T;
}

function assertSha256(value: string): void {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new ContractInvariantError("CONTENT_DIGEST", "published contracts require a 64-character SHA-256 digest");
  }
}

function assertTaskBlocks(blocks: readonly RequirementTaskBlock[]): void {
  if (!blocks.length) throw new ContractInvariantError("TASK_BLOCKS_REQUIRED", "a contract needs at least one task block");
  const seen = new Set<string>();
  for (const block of blocks) {
    if (!block.requirementId) throw new ContractInvariantError("TASK_BLOCK_ID", "requirement ids must be non-empty");
    if (seen.has(block.requirementId)) throw new ContractInvariantError("TASK_BLOCK_ID", `duplicate requirement id: ${block.requirementId}`);
    if (!/^[0-9a-f]{64}$/i.test(block.acceptanceFingerprint)) {
      throw new ContractInvariantError("TASK_BLOCK_FINGERPRINT", `task ${block.requirementId} requires a SHA-256 acceptance fingerprint`);
    }
    seen.add(block.requirementId);
  }
}

export type DraftInput = {
  contractId: string;
  content: JobIntelligence;
  correlationId: string;
  taskBlocks: RequirementTaskBlock[];
};

/** Create version 1 in DRAFT. A draft has no canonical digest yet. */
export function draftContract(input: DraftInput): RequirementContract {
  if (!input.contractId) throw new ContractInvariantError("IDENTITY", "contractId is required");
  if (!input.correlationId) throw new ContractInvariantError("CORRELATION", "correlationId is required");
  assertTaskBlocks(input.taskBlocks);
  return {
    contractId: input.contractId,
    version: 1,
    status: "DRAFT",
    content: input.content,
    contentHash: null,
    publishedAt: null,
    supersededBy: null,
    supersedeReason: null,
    correlationId: input.correlationId,
    taskBlocks: input.taskBlocks.map(block => ({ ...block })),
  };
}

/** DRAFT -> PUBLISHED. Hashing is supplied by the application boundary. */
export function publish(
  contract: RequirementContract,
  input: { publishedAt: string; contentHash: string },
): RequirementContract {
  if (contract.status !== "DRAFT") {
    throw new ContractInvariantError("PUBLISH_ONCE", `only a DRAFT can be published; ${contract.contractId} v${contract.version} is ${contract.status}`);
  }
  if (!input.publishedAt) throw new ContractInvariantError("PUBLISH_TIME", "publishedAt is required");
  assertSha256(input.contentHash);
  return deepFrozenClone({ ...contract, status: "PUBLISHED" as const, publishedAt: input.publishedAt, contentHash: input.contentHash });
}

export type SupersedeInput = {
  previous: RequirementContract;
  content: JobIntelligence;
  contentHash: string;
  reason: string;
  correlationId: string;
  taskBlocks: RequirementTaskBlock[];
  publishedAt: string;
};

/**
 * Build the next immutable version. Persistence of both versions is an
 * application/repository responsibility and MUST be atomic.
 */
export function supersede(input: SupersedeInput): { superseded: RequirementContract; next: RequirementContract } {
  const { previous } = input;
  if (previous.status !== "PUBLISHED") {
    throw new ContractInvariantError("SUPERSEDE_PUBLISHED_ONLY", `only a PUBLISHED contract can be superseded; v${previous.version} is ${previous.status}`);
  }
  if (!input.reason?.trim()) throw new ContractInvariantError("SUPERSEDE_REASON", "a supersede reason is required");
  if (!input.publishedAt) throw new ContractInvariantError("PUBLISH_TIME", "publishedAt is required");
  if (!input.correlationId) throw new ContractInvariantError("CORRELATION", "correlationId is required");
  assertSha256(input.contentHash);
  assertTaskBlocks(input.taskBlocks);
  if (previous.contentHash === input.contentHash && sameTaskFingerprints(previous.taskBlocks, input.taskBlocks)) {
    throw new ContractInvariantError("NO_MATERIAL_CHANGE", "identical requirements must not create a new contract version");
  }

  const nextVersion = previous.version + 1;
  const next = deepFrozenClone<RequirementContract>({
    contractId: previous.contractId,
    version: nextVersion,
    status: "PUBLISHED",
    content: input.content,
    contentHash: input.contentHash,
    publishedAt: input.publishedAt,
    supersededBy: null,
    supersedeReason: null,
    correlationId: input.correlationId,
    taskBlocks: input.taskBlocks,
  });
  const superseded = deepFrozenClone<RequirementContract>({
    ...previous,
    status: "SUPERSEDED",
    supersededBy: nextVersion,
    supersedeReason: input.reason.trim(),
  });
  return { superseded, next };
}

export function sameTaskFingerprints(a: readonly RequirementTaskBlock[], b: readonly RequirementTaskBlock[]): boolean {
  if (a.length !== b.length) return false;
  const right = new Map(b.map(block => [block.requirementId, block.acceptanceFingerprint]));
  return a.every(block => right.get(block.requirementId) === block.acceptanceFingerprint);
}

/** Seed downstream lifecycle state from an immutable published contract. */
export function initializeLifecycle(contract: RequirementContract): TaskBlockLifecycleIdentity[] {
  requirePublished(contract);
  return contract.taskBlocks.map(block => ({
    contractId: contract.contractId,
    contractVersion: contract.version,
    requirementId: block.requirementId,
    acceptanceFingerprint: block.acceptanceFingerprint,
    fulfillmentId: null,
    executionId: null,
  }));
}

/**
 * Carry downstream state to a new requirement version only when the provider-
 * accepted requirement fingerprint is unchanged. Material task changes clear
 * fulfillment and execution for that task only.
 */
export function carryLifecycleForward(
  previous: readonly TaskBlockLifecycleIdentity[],
  nextContract: RequirementContract,
): TaskBlockLifecycleIdentity[] {
  requirePublished(nextContract);
  return nextContract.taskBlocks.map(block => {
    const prior = previous.find(item => item.requirementId === block.requirementId);
    const unchanged = prior?.acceptanceFingerprint === block.acceptanceFingerprint;
    return {
      contractId: nextContract.contractId,
      contractVersion: nextContract.version,
      requirementId: block.requirementId,
      acceptanceFingerprint: block.acceptanceFingerprint,
      fulfillmentId: unchanged ? prior?.fulfillmentId ?? null : null,
      executionId: unchanged ? prior?.executionId ?? null : null,
    };
  });
}

export function assignFulfillment(
  state: readonly TaskBlockLifecycleIdentity[],
  requirementId: string,
  fulfillmentId: string,
): TaskBlockLifecycleIdentity[] {
  return updateLifecycle(state, requirementId, item => {
    if (item.fulfillmentId === fulfillmentId) return item;
    return { ...item, fulfillmentId, executionId: null };
  });
}

export function releaseFulfillment(
  state: readonly TaskBlockLifecycleIdentity[],
  requirementId: string,
): TaskBlockLifecycleIdentity[] {
  return updateLifecycle(state, requirementId, item => ({ ...item, fulfillmentId: null, executionId: null }));
}

export function beginExecution(
  state: readonly TaskBlockLifecycleIdentity[],
  requirementId: string,
  executionId: string,
): TaskBlockLifecycleIdentity[] {
  return updateLifecycle(state, requirementId, item => {
    if (!item.fulfillmentId) {
      throw new ContractInvariantError("EXECUTION_REQUIRES_FULFILLMENT", `task ${requirementId} cannot begin execution before a provider is assigned`);
    }
    return { ...item, executionId };
  });
}

function updateLifecycle(
  state: readonly TaskBlockLifecycleIdentity[],
  requirementId: string,
  update: (item: TaskBlockLifecycleIdentity) => TaskBlockLifecycleIdentity,
): TaskBlockLifecycleIdentity[] {
  const index = state.findIndex(item => item.requirementId === requirementId);
  if (index < 0) throw new ContractInvariantError("UNKNOWN_TASK_BLOCK", `no task block ${requirementId} in this lifecycle state`);
  const next = state.map(item => ({ ...item }));
  next[index] = update(next[index]);
  return next;
}

export function resolveReference(history: readonly RequirementContract[], reference: string): RequirementContract {
  const at = reference.lastIndexOf("@");
  if (at < 1) throw new ContractInvariantError("REFERENCE_FORMAT", `malformed reference: ${reference}`);
  const contractId = reference.slice(0, at);
  const version = Number(reference.slice(at + 1));
  if (!Number.isInteger(version) || version < 1) throw new ContractInvariantError("REFERENCE_FORMAT", `malformed version in: ${reference}`);
  const found = history.find(contract => contract.contractId === contractId && contract.version === version);
  if (!found) throw new ContractInvariantError("REFERENCE_UNRESOLVED", `no such contract version: ${reference}`);
  return found;
}

export function referenceTo(contract: RequirementContract): string {
  requirePublishedOrSuperseded(contract);
  return `${contract.contractId}@${contract.version}`;
}

export function currentVersion(history: readonly RequirementContract[], contractId: string): RequirementContract | null {
  const published = history.filter(contract => contract.contractId === contractId && contract.status === "PUBLISHED");
  if (published.length > 1) throw new ContractInvariantError("SINGLE_PUBLISHED_VERSION", `${contractId} has ${published.length} PUBLISHED versions; lineage has forked`);
  return published[0] ?? null;
}

export function contentChanged(a: RequirementContract, b: RequirementContract): boolean {
  if (!a.contentHash || !b.contentHash) throw new ContractInvariantError("CONTENT_DIGEST", "change detection requires published digests");
  return a.contentHash !== b.contentHash || !sameTaskFingerprints(a.taskBlocks, b.taskBlocks);
}

function requirePublished(contract: RequirementContract): void {
  if (contract.status !== "PUBLISHED" || !contract.contentHash) {
    throw new ContractInvariantError("PUBLISHED_REQUIRED", `operation requires a PUBLISHED contract; ${contract.contractId} v${contract.version} is ${contract.status}`);
  }
}

function requirePublishedOrSuperseded(contract: RequirementContract): void {
  if (contract.status === "DRAFT" || !contract.contentHash) {
    throw new ContractInvariantError("NO_DRAFT_REFERENCES", `cannot reference a DRAFT contract (${contract.contractId} v${contract.version})`);
  }
}
