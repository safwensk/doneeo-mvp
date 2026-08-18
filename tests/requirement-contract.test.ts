import test from "node:test";
import assert from "node:assert/strict";

import {
  ContractInvariantError,
  type RequirementContract,
  assignFulfillment,
  beginExecution,
  contentChanged,
  currentVersion,
  draftContract,
  publish,
  referenceTo,
  releaseFulfillment,
  resolveReference,
  stableStringify,
  supersede,
} from "../lib/requirement-contract";
import type { JobIntelligence } from "../lib/planner";
import { digestContent, digestsEqual, sha256Hex } from "../lib/content-digest";

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

function plan(overrides: Partial<JobIntelligence> = {}): JobIntelligence {
  return {
    version: "1",
    facts: [],
    primitives: [],
    resources: [],
    workstreams: [],
    fulfillment: {
      mode: "single_team",
      singleCustomerOrder: true,
      rationale: "one crew, one order",
      groups: [],
    },
    manpower: { minimum: 2, recommended: 2, reason: "stairs", alternatives: [] },
    estimate: {
      ready: true,
      personMinutes: 120,
      executionMinutes: 60,
      accessMinutes: 7,
      routeMinutes: 18,
      bufferMinutes: 10,
      totalMinutes: 95,
      rangeLow: 80,
      rangeHigh: 110,
      equation: "work + access + travel + buffer",
      assumptions: ["couch fits the stairwell"],
    },
    confidence: { level: "high", score: 0.9, reason: "addresses resolved" },
    unresolved: [],
    ...overrides,
  } as JobIntelligence;
}

/**
 * Digesting is async and lives at the application boundary, so tests precompute.
 * Structural tests only need a well-formed digest; the change-detection tests
 * compute their own and assert on the value.
 */
const PLAN_HASH = await digestContent(plan());

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T11:30:00.000Z";

function published(): RequirementContract {
  return publish(
    draftContract({
      contractId: "WC-4471",
      content: plan(),
      correlationId: "corr-1",
      requirementIds: ["rq-pickup", "rq-carry", "rq-place"],
      contentHash: PLAN_HASH,
    }),
    T1,
  );
}

/* ------------------------------------------------------------------ *
 * Content hashing
 * ------------------------------------------------------------------ */

test("stableStringify sorts keys at every depth", () => {
  const a = { b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } };
  const b = { a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test("stableStringify preserves array order — task sequence is meaningful", () => {
  assert.notEqual(stableStringify([1, 2, 3]), stableStringify([3, 2, 1]));
});

test("stableStringify ignores undefined values but keeps explicit null", () => {
  assert.equal(stableStringify({ a: 1, b: undefined }), stableStringify({ a: 1 }));
  assert.notEqual(stableStringify({ a: 1, b: null }), stableStringify({ a: 1 }));
});

test("digestContent is deterministic across key ordering", async () => {
  const a = plan();
  const b = plan();
  assert.equal(await digestContent(a), await digestContent(b));
});

test("digestContent changes when the plan changes", async () => {
  const before = await digestContent(plan());
  const after = await digestContent(
    plan({ manpower: { minimum: 3, recommended: 3, reason: "sectional", alternatives: [] } }),
  );
  assert.notEqual(before, after);
});

test("digestContent is a 64-character lowercase hex SHA-256", async () => {
  assert.match(await digestContent(plan()), /^[0-9a-f]{64}$/);
});

/**
 * CONFORMANCE — the test whose absence let a real defect ship.
 *
 * The previous implementation was documented as FNV-1a 64-bit and was not. Its tests
 * asserted determinism and change-sensitivity, both of which a wrong hash satisfies,
 * so nothing failed. Any hash claiming to be a named standard must be checked against
 * that standard's published vectors, not merely against itself.
 */
test("sha256Hex matches published SHA-256 test vectors", async () => {
  assert.equal(
    await sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("digestContent hashes the canonical form, not raw JSON.stringify", async () => {
  const reordered = { estimate: plan().estimate, version: plan().version };
  const sameShape = { version: plan().version, estimate: plan().estimate };
  assert.notEqual(JSON.stringify(reordered), JSON.stringify(sameShape));
  assert.equal(await digestContent(reordered), await digestContent(sameShape));
});

test("digestsEqual compares digests without early exit", () => {
  const a = "a".repeat(64);
  assert.equal(digestsEqual(a, a), true);
  assert.equal(digestsEqual(a, "b" + "a".repeat(63)), false);
  assert.equal(digestsEqual(a, "a".repeat(63)), false);
});

test("a malformed digest is rejected at the domain boundary", () => {
  for (const bad of ["", "abc", "A".repeat(64), "z".repeat(64), "a".repeat(63), "a".repeat(65)]) {
    assert.throws(
      () =>
        draftContract({
          contractId: "WC-1",
          content: plan(),
          correlationId: "c",
          requirementIds: ["rq-a"],
          contentHash: bad,
        }),
      (e: ContractInvariantError) => e.invariant === "CONTENT_DIGEST",
      `expected ${JSON.stringify(bad)} to be rejected`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * Draft and publish
 * ------------------------------------------------------------------ */

test("a draft starts at version 1 and is not publishable downstream", () => {
  const draft = draftContract({
    contractId: "WC-1",
    content: plan(),
    correlationId: "corr-1",
    requirementIds: ["rq-a"],
      contentHash: PLAN_HASH,
  });
  assert.equal(draft.version, 1);
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.publishedAt, null);
  assert.throws(() => referenceTo(draft), (e: ContractInvariantError) => e.invariant === "NO_DRAFT_REFERENCES");
});

test("a contract requires at least one task block", () => {
  assert.throws(
    () => draftContract({ contractId: "WC-1", content: plan(), correlationId: "c", requirementIds: [], contentHash: PLAN_HASH }),
    (e: ContractInvariantError) => e.invariant === "TASK_BLOCKS_REQUIRED",
  );
});

test("duplicate requirement ids are rejected", () => {
  assert.throws(
    () => draftContract({ contractId: "WC-1", content: plan(), correlationId: "c", requirementIds: ["a", "a"], contentHash: PLAN_HASH }),
    (e: ContractInvariantError) => e.invariant === "TASK_BLOCK_ID",
  );
});

test("publishing sets the timestamp and freezes the record", () => {
  const contract = published();
  assert.equal(contract.status, "PUBLISHED");
  assert.equal(contract.publishedAt, T1);
  assert.ok(Object.isFrozen(contract));
});

test("a published contract cannot be published again", () => {
  const contract = published();
  assert.throws(() => publish(contract, T2), (e: ContractInvariantError) => e.invariant === "PUBLISH_ONCE");
});

test("a published contract is immutable in place", () => {
  const contract = published();
  assert.throws(() => {
    (contract as { status: string }).status = "SUPERSEDED";
  }, TypeError);
});

/* ------------------------------------------------------------------ *
 * Supersede
 * ------------------------------------------------------------------ */

test("superseding produces v2 and links the lineage both ways", () => {
  const v1 = published();
  const { superseded, next } = supersede({
    previous: v1,
    content: plan({ unresolved: ["stairwell width"] }),
    reason: "customer corrected the floor count",
    correlationId: "corr-2",
    requirementIds: ["rq-pickup", "rq-carry", "rq-place"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });

  assert.equal(next.version, 2);
  assert.equal(next.status, "PUBLISHED");
  assert.equal(next.contractId, v1.contractId);
  assert.equal(superseded.status, "SUPERSEDED");
  assert.equal(superseded.supersededBy, 2);
  assert.equal(superseded.supersedeReason, "customer corrected the floor count");
});

test("superseding without a reason is refused — silent replacement is the failure this prevents", () => {
  const v1 = published();
  for (const reason of ["", "   "]) {
    assert.throws(
      () =>
        supersede({
          previous: v1,
          content: plan(),
          reason,
          correlationId: "c",
          requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
          publishedAt: T2,
        }),
      (e: ContractInvariantError) => e.invariant === "SUPERSEDE_REASON",
    );
  }
});

test("only a PUBLISHED contract can be superseded", () => {
  const draft = draftContract({
    contractId: "WC-1",
    content: plan(),
    correlationId: "c",
    requirementIds: ["rq-a"],
      contentHash: PLAN_HASH,
  });
  assert.throws(
    () =>
      supersede({
        previous: draft,
        content: plan(),
        reason: "why not",
        correlationId: "c",
        requirementIds: ["rq-a"],
      contentHash: PLAN_HASH,
        publishedAt: T2,
      }),
    (e: ContractInvariantError) => e.invariant === "SUPERSEDE_PUBLISHED_ONLY",
  );
});

test("a superseded contract cannot be superseded again — no forked lineage", () => {
  const v1 = published();
  const { superseded } = supersede({
    previous: v1,
    content: plan({ unresolved: ["a"] }),
    reason: "first change",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });
  assert.throws(
    () =>
      supersede({
        previous: superseded,
        content: plan({ unresolved: ["b"] }),
        reason: "second change",
        correlationId: "c3",
        requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
        publishedAt: T2,
      }),
    (e: ContractInvariantError) => e.invariant === "SUPERSEDE_PUBLISHED_ONLY",
  );
});

test("versions are monotonic across a chain of revisions", () => {
  let current = published();
  const seen = [current.version];
  for (let i = 0; i < 4; i++) {
    const { next } = supersede({
      previous: current,
      content: plan({ unresolved: [`round-${i}`] }),
      reason: `revision ${i}`,
      correlationId: `corr-${i}`,
      requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
      publishedAt: T2,
    });
    current = next;
    seen.push(current.version);
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
});

test("an already-matched task block survives a re-plan", () => {
  const v1 = assignFulfillment(published(), "rq-carry", "flf-marc");
  const { next } = supersede({
    previous: v1,
    content: plan({ unresolved: ["revised"] }),
    reason: "customer added a task",
    correlationId: "corr-2",
    requirementIds: ["rq-pickup", "rq-carry", "rq-place", "rq-dispose"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });
  assert.equal(next.taskBlocks.find((b) => b.requirementId === "rq-carry")?.fulfillmentId, "flf-marc");
  assert.equal(next.taskBlocks.find((b) => b.requirementId === "rq-dispose")?.fulfillmentId, null);
  assert.equal(next.taskBlocks.length, 4);
});

/* ------------------------------------------------------------------ *
 * The three-lifecycle split
 * ------------------------------------------------------------------ */

test("a provider decline clears fulfillment without touching the requirement", () => {
  const matched = assignFulfillment(published(), "rq-carry", "flf-david");
  const released = releaseFulfillment(matched, "rq-carry");

  const block = released.taskBlocks.find((b) => b.requirementId === "rq-carry");
  assert.equal(block?.fulfillmentId, null);
  assert.equal(block?.requirementId, "rq-carry");
  assert.equal(released.taskBlocks.length, 3);
  assert.equal(released.status, "PUBLISHED");
  assert.equal(released.version, 1);
});

test("matching a provider does not change the content hash — a match is not a re-plan", () => {
  const before = published();
  const after = assignFulfillment(before, "rq-carry", "flf-marc");
  assert.equal(after.contentHash, before.contentHash);
  assert.equal(contentChanged(before, after), false);
});

test("assigning the same fulfillment twice is idempotent", () => {
  const once = assignFulfillment(published(), "rq-carry", "flf-marc");
  const twice = assignFulfillment(once, "rq-carry", "flf-marc");
  assert.deepEqual(twice.taskBlocks, once.taskBlocks);
});

test("re-matching a different provider clears any execution identity", () => {
  let c = assignFulfillment(published(), "rq-carry", "flf-david");
  c = beginExecution(c, "rq-carry", "exe-1");
  c = assignFulfillment(c, "rq-carry", "flf-marc");
  const block = c.taskBlocks.find((b) => b.requirementId === "rq-carry");
  assert.equal(block?.fulfillmentId, "flf-marc");
  assert.equal(block?.executionId, null);
});

test("execution cannot begin before a provider is assigned", () => {
  assert.throws(
    () => beginExecution(published(), "rq-carry", "exe-1"),
    (e: ContractInvariantError) => e.invariant === "EXECUTION_REQUIRES_FULFILLMENT",
  );
});

test("an unknown task block is refused rather than silently created", () => {
  assert.throws(
    () => assignFulfillment(published(), "rq-nonexistent", "flf-1"),
    (e: ContractInvariantError) => e.invariant === "UNKNOWN_TASK_BLOCK",
  );
});

test("a superseded contract rejects task-block mutation", () => {
  const { superseded } = supersede({
    previous: published(),
    content: plan({ unresolved: ["x"] }),
    reason: "revised",
    correlationId: "c",
    requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });
  assert.throws(
    () => assignFulfillment(superseded, "rq-carry", "flf-1"),
    (e: ContractInvariantError) => e.invariant === "NO_SUPERSEDED_MUTATION",
  );
});

/* ------------------------------------------------------------------ *
 * Resolution — "the same plan persists"
 * ------------------------------------------------------------------ */

test("an offer made against v2 still resolves to v2 after v3 exists", () => {
  const v1 = published();
  const step2 = supersede({
    previous: v1,
    content: plan({ unresolved: ["second"] }),
    reason: "second",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });
  const offerReference = referenceTo(step2.next); // the customer accepted v2
  const step3 = supersede({
    previous: step2.next,
    content: plan({ unresolved: ["third"] }),
    reason: "third",
    correlationId: "c3",
    requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });

  const history = [step2.superseded, step3.superseded, step3.next];
  const resolved = resolveReference(history, offerReference);

  assert.equal(resolved.version, 2);
  assert.equal(resolved.contentHash, step2.next.contentHash);
  assert.equal(resolved.status, "SUPERSEDED");
});

test("references round-trip through referenceTo and resolveReference", () => {
  const contract = published();
  assert.equal(resolveReference([contract], referenceTo(contract)), contract);
});

test("a reference to a version that does not exist is an error, not a nearest match", () => {
  assert.throws(
    () => resolveReference([published()], "WC-4471@7"),
    (e: ContractInvariantError) => e.invariant === "REFERENCE_UNRESOLVED",
  );
});

test("malformed references are rejected", () => {
  const history = [published()];
  for (const bad of ["WC-4471", "@2", "WC-4471@", "WC-4471@0", "WC-4471@x", "WC-4471@1.5"]) {
    assert.throws(
      () => resolveReference(history, bad),
      (e: ContractInvariantError) => e.invariant === "REFERENCE_FORMAT" || e.invariant === "REFERENCE_UNRESOLVED",
      `expected ${bad} to be rejected`,
    );
  }
});

test("contract ids containing @ still resolve — the last @ wins", () => {
  const odd = publish(
    draftContract({
      contractId: "tenant@acme/WC-9",
      content: plan(),
      correlationId: "c",
      requirementIds: ["rq-a"],
      contentHash: PLAN_HASH,
    }),
    T1,
  );
  assert.equal(resolveReference([odd], referenceTo(odd)).contractId, "tenant@acme/WC-9");
});

/* ------------------------------------------------------------------ *
 * Current version
 * ------------------------------------------------------------------ */

test("exactly one version is current at a time", () => {
  const step = supersede({
    previous: published(),
    content: plan({ unresolved: ["x"] }),
    reason: "revised",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
    publishedAt: T2,
  });
  const history = [step.superseded, step.next];
  assert.equal(currentVersion(history, "WC-4471")?.version, 2);
});

test("currentVersion returns null for an unknown contract", () => {
  assert.equal(currentVersion([published()], "WC-nope"), null);
});

test("a forked lineage is detected rather than silently picking one", () => {
  const a = published();
  const b = publish(
    draftContract({
      contractId: "WC-4471",
      content: plan({ unresolved: ["fork"] }),
      correlationId: "c2",
      requirementIds: ["rq-pickup"],
      contentHash: PLAN_HASH,
    }),
    T2,
  );
  assert.throws(
    () => currentVersion([a, b], "WC-4471"),
    (e: ContractInvariantError) => e.invariant === "SINGLE_PUBLISHED_VERSION",
  );
});

/* ------------------------------------------------------------------ *
 * Change detection
 * ------------------------------------------------------------------ */

test("a re-plan that produces an identical plan is not a change", async () => {
  const v1 = published();
  const identical = plan();
  const { next } = supersede({
    previous: v1,
    content: identical,
    reason: "re-ran the planner",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
    contentHash: await digestContent(identical),
    publishedAt: T2,
  });
  assert.equal(contentChanged(v1, next), false);
});

test("a re-plan that changes crew size is a change", async () => {
  const v1 = published();
  const heavier = plan({ manpower: { minimum: 3, recommended: 3, reason: "sectional", alternatives: [] } });
  const { next } = supersede({
    previous: v1,
    content: heavier,
    reason: "customer corrected the couch size",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
    contentHash: await digestContent(heavier),
    publishedAt: T2,
  });
  assert.equal(contentChanged(v1, next), true);
});

/* ------------------------------------------------------------------ *
 * Required inputs
 * ------------------------------------------------------------------ */

test("identity and correlation are mandatory", () => {
  assert.throws(
    () => draftContract({ contractId: "", content: plan(), correlationId: "c", requirementIds: ["a"], contentHash: PLAN_HASH }),
    (e: ContractInvariantError) => e.invariant === "IDENTITY",
  );
  assert.throws(
    () => draftContract({ contractId: "WC-1", content: plan(), correlationId: "", requirementIds: ["a"], contentHash: PLAN_HASH }),
    (e: ContractInvariantError) => e.invariant === "CORRELATION",
  );
});

test("publishing without a timestamp is refused", () => {
  const draft = draftContract({
    contractId: "WC-1",
    content: plan(),
    correlationId: "c",
    requirementIds: ["a"],
      contentHash: PLAN_HASH,
  });
  assert.throws(() => publish(draft, ""), (e: ContractInvariantError) => e.invariant === "PUBLISH_TIME");
});

/* ------------------------------------------------------------------ *
 * Deep immutability — P0-D
 *
 * Object.freeze is shallow. Before this, a published contract's top-level
 * properties were protected while `content` and the task-block objects
 * underneath stayed mutable through nested references.
 * ------------------------------------------------------------------ */

test("published content cannot be mutated through a nested reference", () => {
  const contract = published();
  assert.throws(() => {
    (contract.content.manpower as { minimum: number }).minimum = 99;
  }, TypeError);
  assert.equal(contract.content.manpower.minimum, 2);
});

test("deeply nested arrays and objects in published content are frozen", () => {
  const contract = published();
  assert.ok(Object.isFrozen(contract.content));
  assert.ok(Object.isFrozen(contract.content.estimate));
  assert.ok(Object.isFrozen(contract.content.estimate.assumptions));
  assert.throws(() => {
    (contract.content.estimate.assumptions as string[]).push("smuggled in");
  }, TypeError);
  assert.equal(contract.content.estimate.assumptions.length, 1);
});

test("publishing snapshots the content — the caller keeps a mutable original", () => {
  const original = plan();
  const contract = publish(
    draftContract({
      contractId: "WC-snapshot",
      content: original,
      correlationId: "c",
      requirementIds: ["rq-a"],
      contentHash: PLAN_HASH,
    }),
    T1,
  );
  // The caller's object is untouched, so publishing has no surprising side effect...
  assert.ok(!Object.isFrozen(original));
  original.manpower.minimum = 42;
  // ...and mutating it afterwards cannot reach what was published.
  assert.equal(contract.content.manpower.minimum, 2);
});

test("task block identities are frozen on a published contract", () => {
  const contract = published();
  assert.ok(Object.isFrozen(contract.taskBlocks));
  assert.throws(() => {
    (contract.taskBlocks[0] as { requirementId: string }).requirementId = "tampered";
  }, TypeError);
});
