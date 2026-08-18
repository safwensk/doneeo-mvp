import test from "node:test";
import assert from "node:assert/strict";

import {
  ContractInvariantError,
  type RequirementContract,
  assignFulfillment,
  beginExecution,
  contentChanged,
  contentHash,
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

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T11:30:00.000Z";

function published(): RequirementContract {
  return publish(
    draftContract({
      contractId: "WC-4471",
      content: plan(),
      correlationId: "corr-1",
      requirementIds: ["rq-pickup", "rq-carry", "rq-place"],
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

test("contentHash is deterministic across key ordering", () => {
  const one = plan();
  const two = JSON.parse(JSON.stringify(plan(), Object.keys(plan()).sort()));
  assert.equal(contentHash(one), contentHash({ ...two, ...one }));
});

test("contentHash changes when the plan changes", () => {
  const before = contentHash(plan());
  const after = contentHash(plan({ manpower: { minimum: 3, recommended: 3, reason: "sectional", alternatives: [] } }));
  assert.notEqual(before, after);
});

test("contentHash is a fixed-width hex digest", () => {
  assert.match(contentHash(plan()), /^[0-9a-f]{16}$/);
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
  });
  assert.equal(draft.version, 1);
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.publishedAt, null);
  assert.throws(() => referenceTo(draft), (e: ContractInvariantError) => e.invariant === "NO_DRAFT_REFERENCES");
});

test("a contract requires at least one task block", () => {
  assert.throws(
    () => draftContract({ contractId: "WC-1", content: plan(), correlationId: "c", requirementIds: [] }),
    (e: ContractInvariantError) => e.invariant === "TASK_BLOCKS_REQUIRED",
  );
});

test("duplicate requirement ids are rejected", () => {
  assert.throws(
    () => draftContract({ contractId: "WC-1", content: plan(), correlationId: "c", requirementIds: ["a", "a"] }),
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
  });
  assert.throws(
    () =>
      supersede({
        previous: draft,
        content: plan(),
        reason: "why not",
        correlationId: "c",
        requirementIds: ["rq-a"],
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
    publishedAt: T2,
  });
  const offerReference = referenceTo(step2.next); // the customer accepted v2
  const step3 = supersede({
    previous: step2.next,
    content: plan({ unresolved: ["third"] }),
    reason: "third",
    correlationId: "c3",
    requirementIds: ["rq-pickup"],
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

test("a re-plan that produces an identical plan is not a change", () => {
  const v1 = published();
  const { next } = supersede({
    previous: v1,
    content: plan(),
    reason: "re-ran the planner",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
    publishedAt: T2,
  });
  assert.equal(contentChanged(v1, next), false);
});

test("a re-plan that changes crew size is a change", () => {
  const v1 = published();
  const { next } = supersede({
    previous: v1,
    content: plan({ manpower: { minimum: 3, recommended: 3, reason: "sectional", alternatives: [] } }),
    reason: "customer corrected the couch size",
    correlationId: "c2",
    requirementIds: ["rq-pickup"],
    publishedAt: T2,
  });
  assert.equal(contentChanged(v1, next), true);
});

/* ------------------------------------------------------------------ *
 * Required inputs
 * ------------------------------------------------------------------ */

test("identity and correlation are mandatory", () => {
  assert.throws(
    () => draftContract({ contractId: "", content: plan(), correlationId: "c", requirementIds: ["a"] }),
    (e: ContractInvariantError) => e.invariant === "IDENTITY",
  );
  assert.throws(
    () => draftContract({ contractId: "WC-1", content: plan(), correlationId: "", requirementIds: ["a"] }),
    (e: ContractInvariantError) => e.invariant === "CORRELATION",
  );
});

test("publishing without a timestamp is refused", () => {
  const draft = draftContract({
    contractId: "WC-1",
    content: plan(),
    correlationId: "c",
    requirementIds: ["a"],
  });
  assert.throws(() => publish(draft, ""), (e: ContractInvariantError) => e.invariant === "PUBLISH_TIME");
});
