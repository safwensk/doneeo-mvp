/**
 * Requirement Contract — the boundary between Intelligence and everything downstream.
 *
 * Platform Architecture §12 P1: "The versioned contract as a real object with
 * publish/supersede, plus the three-lifecycle TaskBlock split. Exit: downstream
 * consumes stable versioned requirements. This is the single highest-value
 * structural change and the most expensive to retrofit."
 *
 * WHY THIS EXISTS
 *
 * Before this module, a plan was computed and passed around as data. Nothing gave
 * it an identity, so "the same plan persists after payment" was a hope rather than
 * a property — there was no identity to persist, and no way to prove that what the
 * provider accepted was what the customer approved.
 *
 * A RequirementContract gives the plan four things it did not have:
 *
 *   1. IDENTITY   — a contractId stable across every revision of one WorkCase.
 *   2. VERSION    — monotonic from 1; a reference to v2 resolves to v2 forever.
 *   3. IMMUTABILITY — once published, content cannot change. Change means a new
 *                    version with a recorded reason, never an edit in place.
 *   4. LINEAGE    — every supersession records what replaced what, and why.
 *
 * Everything downstream — options, provider offers, scope contracts, change
 * orders, settlement — references `contractId@version`, never a raw plan object.
 *
 * These functions are PURE. No database, no clock, no I/O. Time and identity are
 * injected so the invariants are testable without infrastructure, and so the same
 * code runs unchanged on Cloudflare Workers.
 */

import type { JobIntelligence } from "./planner";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type ContractStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";

/**
 * The three-lifecycle TaskBlock split (P1).
 *
 * One unit of work has three identities with three different lifetimes, and
 * conflating them is what makes change orders and re-matching so painful later:
 *
 *   requirementId — assigned when the contract is drafted. Stable for the life of
 *                   the WorkCase. This is what a customer approved.
 *   fulfillmentId — assigned when a provider is matched. Changes on re-match; a
 *                   declined provider invalidates this and nothing else.
 *   executionId   — assigned when work actually starts. Changes on re-execution
 *                   after a failure.
 *
 * A provider declining must not invalidate the requirement. A re-execution must
 * not invalidate the match. Separate ids make that structural rather than careful.
 */
export type TaskBlockIdentity = {
  requirementId: string;
  fulfillmentId: string | null;
  executionId: string | null;
};

export type RequirementContract = {
  /** Stable across all versions. Identifies the WorkCase, not the revision. */
  contractId: string;
  /** Monotonic from 1. */
  version: number;
  status: ContractStatus;
  /** The planner output this contract wraps. Frozen once published. */
  content: JobIntelligence;
  /** Deterministic digest of `content`. Equal hashes mean an equal plan. */
  contentHash: string;
  /** ISO timestamp, or null while DRAFT. */
  publishedAt: string | null;
  /** Version that replaced this one, or null. */
  supersededBy: number | null;
  /** Why it was replaced. Never null on a SUPERSEDED contract. */
  supersedeReason: string | null;
  /** Ties every derived record back to the request that caused it. */
  correlationId: string;
  /** Task identities, keyed by requirementId. */
  taskBlocks: TaskBlockIdentity[];
};

export class ContractInvariantError extends Error {
  readonly invariant: string;
  constructor(invariant: string, message: string) {
    super(message);
    this.name = "ContractInvariantError";
    this.invariant = invariant;
  }
}

/* ------------------------------------------------------------------ *
 * Content hashing
 * ------------------------------------------------------------------ */

/**
 * Deterministic JSON: object keys sorted at every depth, so two structurally
 * equal plans serialize identically regardless of construction order.
 *
 * Array order IS significant — task sequence is meaningful, and reordering the
 * steps of a job is a real change to the plan.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + stableStringify(v)).join(",") + "}";
}

/**
 * FNV-1a, 64-bit, as 16 hex characters.
 *
 * Deliberately NOT cryptographic. This answers "did the plan change?", not "did
 * someone tamper with the plan?". It is synchronous, dependency-free and runs
 * identically on Workers and Node — Web Crypto's digest is async, which would
 * force every caller into a promise for no benefit at this boundary.
 *
 * If tamper-evidence is ever required, sign the contract row; do not change this.
 */
export function contentHash(content: unknown): string {
  const input = stableStringify(content);
  let hi = 0xcbf2_9ce4 >>> 0;
  let lo = 0x8422_2325 >>> 0;
  for (let i = 0; i < input.length; i++) {
    lo = (lo ^ input.charCodeAt(i)) >>> 0;
    // multiply by the 64-bit FNV prime (0x100000001b3) in two 32-bit halves
    const lo96 = (lo * 435) >>> 0;
    const hi96 = (hi * 435 + Math.floor((lo * 435) / 0x1_0000_0000)) >>> 0;
    hi = (hi96 ^ (lo << 8)) >>> 0;
    lo = (lo96 + ((lo << 24) >>> 0)) >>> 0;
  }
  return (hi >>> 0).toString(16).padStart(8, "0") + (lo >>> 0).toString(16).padStart(8, "0");
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

export type DraftInput = {
  contractId: string;
  content: JobIntelligence;
  correlationId: string;
  /** Requirement ids, one per task block. Caller supplies them so ids are traceable. */
  requirementIds: string[];
};

/** Create version 1 in DRAFT. Nothing downstream may consume a DRAFT. */
export function draftContract(input: DraftInput): RequirementContract {
  if (!input.contractId) throw new ContractInvariantError("IDENTITY", "contractId is required");
  if (!input.correlationId) throw new ContractInvariantError("CORRELATION", "correlationId is required");
  assertUniqueIds(input.requirementIds);
  return {
    contractId: input.contractId,
    version: 1,
    status: "DRAFT",
    content: input.content,
    contentHash: contentHash(input.content),
    publishedAt: null,
    supersededBy: null,
    supersedeReason: null,
    correlationId: input.correlationId,
    taskBlocks: input.requirementIds.map((requirementId) => ({
      requirementId,
      fulfillmentId: null,
      executionId: null,
    })),
  };
}

/**
 * DRAFT → PUBLISHED. After this the content is immutable and downstream may
 * consume it. Publishing an already-published contract is an error rather than a
 * no-op, because a silent no-op hides a caller bug.
 */
export function publish(contract: RequirementContract, publishedAt: string): RequirementContract {
  if (contract.status !== "DRAFT") {
    throw new ContractInvariantError(
      "PUBLISH_ONCE",
      `only a DRAFT can be published; ${contract.contractId} v${contract.version} is ${contract.status}`,
    );
  }
  if (!publishedAt) throw new ContractInvariantError("PUBLISH_TIME", "publishedAt is required");
  return Object.freeze({ ...contract, status: "PUBLISHED" as const, publishedAt });
}

export type SupersedeInput = {
  previous: RequirementContract;
  content: JobIntelligence;
  reason: string;
  correlationId: string;
  requirementIds: string[];
  publishedAt: string;
};

/**
 * Publish a replacement version and mark the previous one superseded.
 *
 * Returns BOTH records. The caller must persist both in one transaction — a
 * superseded contract with no successor, or a successor with no predecessor
 * marked, is a corrupt lineage.
 *
 * A reason is mandatory. Silent replacement is the failure this whole boundary
 * exists to prevent.
 */
export function supersede(input: SupersedeInput): {
  superseded: RequirementContract;
  next: RequirementContract;
} {
  const { previous } = input;
  if (previous.status !== "PUBLISHED") {
    throw new ContractInvariantError(
      "SUPERSEDE_PUBLISHED_ONLY",
      `only a PUBLISHED contract can be superseded; v${previous.version} is ${previous.status}`,
    );
  }
  if (!input.reason || !input.reason.trim()) {
    throw new ContractInvariantError("SUPERSEDE_REASON", "a supersede reason is required");
  }
  if (!input.publishedAt) throw new ContractInvariantError("PUBLISH_TIME", "publishedAt is required");
  assertUniqueIds(input.requirementIds);

  const nextVersion = previous.version + 1;
  const next: RequirementContract = Object.freeze({
    contractId: previous.contractId,
    version: nextVersion,
    status: "PUBLISHED" as const,
    content: input.content,
    contentHash: contentHash(input.content),
    publishedAt: input.publishedAt,
    supersededBy: null,
    supersedeReason: null,
    correlationId: input.correlationId,
    // Task identities carry forward where the requirement still exists, so a
    // re-plan does not silently orphan an already-matched task block.
    taskBlocks: input.requirementIds.map((requirementId) => {
      const carried = previous.taskBlocks.find((b) => b.requirementId === requirementId);
      return carried
        ? { ...carried }
        : { requirementId, fulfillmentId: null, executionId: null };
    }),
  });

  const superseded = Object.freeze({
    ...previous,
    status: "SUPERSEDED" as const,
    supersededBy: nextVersion,
    supersedeReason: input.reason,
  });

  return { superseded, next };
}

/* ------------------------------------------------------------------ *
 * Task block lifecycle
 * ------------------------------------------------------------------ */

/** Attach a fulfillment identity when a provider is matched. */
export function assignFulfillment(
  contract: RequirementContract,
  requirementId: string,
  fulfillmentId: string,
): RequirementContract {
  return withTaskBlock(contract, requirementId, (block) => {
    if (block.fulfillmentId === fulfillmentId) return block; // idempotent
    return { ...block, fulfillmentId, executionId: null };
  });
}

/**
 * Clear the fulfillment identity when a provider declines.
 *
 * The requirement survives untouched. This is the whole point of the split, and
 * the reason a decline does not restart the customer's job.
 */
export function releaseFulfillment(
  contract: RequirementContract,
  requirementId: string,
): RequirementContract {
  return withTaskBlock(contract, requirementId, (block) => ({
    ...block,
    fulfillmentId: null,
    executionId: null,
  }));
}

/** Attach an execution identity when work actually begins. */
export function beginExecution(
  contract: RequirementContract,
  requirementId: string,
  executionId: string,
): RequirementContract {
  return withTaskBlock(contract, requirementId, (block) => {
    if (!block.fulfillmentId) {
      throw new ContractInvariantError(
        "EXECUTION_REQUIRES_FULFILLMENT",
        `task ${requirementId} cannot begin execution before a provider is assigned`,
      );
    }
    return { ...block, executionId };
  });
}

/* ------------------------------------------------------------------ *
 * Resolution — "the same plan persists"
 * ------------------------------------------------------------------ */

/**
 * Resolve a reference of the form `contractId@version` against contract history.
 *
 * This is the guarantee in executable form: an offer made against v2 still
 * resolves to v2 after v3 exists. Downstream records store the reference, never
 * a copy of the plan, so there is exactly one answer to "what did they agree to".
 */
export function resolveReference(
  history: readonly RequirementContract[],
  reference: string,
): RequirementContract {
  const at = reference.lastIndexOf("@");
  if (at < 1) {
    throw new ContractInvariantError("REFERENCE_FORMAT", `malformed reference: ${reference}`);
  }
  const contractId = reference.slice(0, at);
  const version = Number(reference.slice(at + 1));
  if (!Number.isInteger(version) || version < 1) {
    throw new ContractInvariantError("REFERENCE_FORMAT", `malformed version in: ${reference}`);
  }
  const found = history.find((c) => c.contractId === contractId && c.version === version);
  if (!found) {
    throw new ContractInvariantError("REFERENCE_UNRESOLVED", `no such contract version: ${reference}`);
  }
  return found;
}

export function referenceTo(contract: RequirementContract): string {
  if (contract.status === "DRAFT") {
    throw new ContractInvariantError(
      "NO_DRAFT_REFERENCES",
      `cannot reference a DRAFT contract (${contract.contractId} v${contract.version})`,
    );
  }
  return `${contract.contractId}@${contract.version}`;
}

/** The one PUBLISHED version, or null if none. Throws if the lineage forked. */
export function currentVersion(
  history: readonly RequirementContract[],
  contractId: string,
): RequirementContract | null {
  const published = history.filter((c) => c.contractId === contractId && c.status === "PUBLISHED");
  if (published.length > 1) {
    throw new ContractInvariantError(
      "SINGLE_PUBLISHED_VERSION",
      `${contractId} has ${published.length} PUBLISHED versions; lineage has forked`,
    );
  }
  return published[0] ?? null;
}

/**
 * Did the plan actually change between two versions?
 *
 * Used to keep re-planning honest: if a re-plan produces an identical hash there
 * is nothing to tell the customer about, and a change order would be noise.
 */
export function contentChanged(a: RequirementContract, b: RequirementContract): boolean {
  return a.contentHash !== b.contentHash;
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

function assertUniqueIds(ids: readonly string[]): void {
  if (ids.length === 0) {
    throw new ContractInvariantError("TASK_BLOCKS_REQUIRED", "a contract needs at least one task block");
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) throw new ContractInvariantError("TASK_BLOCK_ID", "requirement ids must be non-empty");
    if (seen.has(id)) {
      throw new ContractInvariantError("TASK_BLOCK_ID", `duplicate requirement id: ${id}`);
    }
    seen.add(id);
  }
}

function withTaskBlock(
  contract: RequirementContract,
  requirementId: string,
  update: (block: TaskBlockIdentity) => TaskBlockIdentity,
): RequirementContract {
  if (contract.status === "SUPERSEDED") {
    throw new ContractInvariantError(
      "NO_SUPERSEDED_MUTATION",
      `cannot modify task blocks on a SUPERSEDED contract (${contract.contractId} v${contract.version})`,
    );
  }
  const index = contract.taskBlocks.findIndex((b) => b.requirementId === requirementId);
  if (index < 0) {
    throw new ContractInvariantError("UNKNOWN_TASK_BLOCK", `no task block ${requirementId} in this contract`);
  }
  const taskBlocks = contract.taskBlocks.slice();
  taskBlocks[index] = update(taskBlocks[index]);
  // Task identities are fulfillment state, not requirement content — updating one
  // must NOT change contentHash, or every provider match would look like a re-plan.
  return Object.freeze({ ...contract, taskBlocks });
}
