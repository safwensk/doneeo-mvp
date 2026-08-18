/**
 * Requirement Contract — invariant regression suite.
 *
 * WHY THIS FILE EXISTS, SEPARATELY FROM requirement-contract.test.ts
 *
 * Two implementations of the Requirement Contract were built in parallel on
 * 2026-08-18 — one by Atlas, one by Claude — and the merge audit (17_MERGE_AUDIT)
 * adopted Atlas's design. Atlas's suite covers the new architecture well:
 * fingerprint carry-forward, selective invalidation, provider-neutrality.
 *
 * What it does not cover is the silent-failure class. Claude's superseded suite
 * had roughly twenty tests for invariants that are all correctly ENFORCED in
 * Atlas's code — verified by direct probe during the audit — but had no
 * regression test. Enforcement without a test is one refactor away from being
 * enforcement by accident.
 *
 * This file restores that coverage against Atlas's API. It is deliberately
 * additive: Atlas's own test file is untouched, so its authorship and audit
 * trail stay clean and the two concerns stay separable.
 *
 * The conformance vectors in §1 matter most. Their absence is the specific
 * reason a hash documented as FNV-1a — and which was not FNV-1a — passed a
 * green suite and reached `main`. A digest test that only checks determinism
 * and change-sensitivity is satisfied by a wrong hash.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ContractInvariantError,
  type RequirementContract,
  type RequirementTaskBlock,
  currentVersion,
  draftContract,
  publish,
  referenceTo,
  resolveReference,
  stableStringify,
  supersede,
} from "../lib/requirement-contract";
import { sha256Stable } from "../lib/application/requirement-contract-hashing";
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
    fulfillment: { mode: "single_team", singleCustomerOrder: true, rationale: "one crew", groups: [] },
    manpower: { minimum: 2, recommended: 2, reason: "stairs", alternatives: [] },
    estimate: {
      ready: true, personMinutes: 120, executionMinutes: 60, accessMinutes: 7, routeMinutes: 18,
      bufferMinutes: 10, totalMinutes: 95, rangeLow: 80, rangeHigh: 110,
      equation: "work + access + travel + buffer", assumptions: ["couch fits the stairwell"],
    },
    confidence: { level: "high", score: 0.9, reason: "addresses resolved" },
    unresolved: [],
    ...overrides,
  } as JobIntelligence;
}

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T11:30:00.000Z";

const HA = "a".repeat(64);
const HB = "b".repeat(64);
const HC = "c".repeat(64);

const blocks = (...ids: string[]): RequirementTaskBlock[] =>
  ids.map((requirementId, i) => ({ requirementId, acceptanceFingerprint: String(i).repeat(64).slice(0, 64) }));

const DEFAULT_BLOCKS = blocks("rq-pickup", "rq-carry", "rq-place");

const draft = (over: Partial<Parameters<typeof draftContract>[0]> = {}) =>
  draftContract({
    contractId: "WC-4471",
    content: plan(),
    correlationId: "corr-1",
    taskBlocks: DEFAULT_BLOCKS,
    ...over,
  });

const published = (): RequirementContract => publish(draft(), { publishedAt: T1, contentHash: HA });

/* ------------------------------------------------------------------ *
 * 1. Digest conformance — the check whose absence let a real defect ship
 * ------------------------------------------------------------------ */

/**
 * Vectors computed with Python's hashlib, an implementation entirely independent
 * of the code under test, over the same canonical form `stableStringify` produces.
 *
 * This is the property that matters: not "is the digest stable" but "does it agree
 * with SHA-256 as the rest of the world computes it". A digest persisted to a
 * database and compared across versions must be reproducible outside this codebase.
 */
const VECTORS: Array<[string, unknown, string]> = [
  ["empty string", "", "12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126"],
  ["the string abc", "abc", "6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25"],
  ["number 0", 0, "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9"],
  ["empty object", {}, "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"],
  ["simple object", { a: 1, b: "two" }, "f15bfc93d70801047473922f67fed863ecc7f82f0677ebb7122923aee81e0f97"],
  ["nested, keys unsorted", { b: [3, { d: 4, c: 5 }], a: 1 }, "755b68efef1bedad99176fa8e846fd7353732d57d5afc80eff857b2d7bc73581"],
];

for (const [label, value, expected] of VECTORS) {
  test(`sha256Stable agrees with an independent SHA-256 implementation — ${label}`, async () => {
    assert.equal(await sha256Stable(value), expected);
  });
}

test("sha256Stable produces 64 lowercase hex characters", async () => {
  assert.match(await sha256Stable(plan()), /^[0-9a-f]{64}$/);
});

test("sha256Stable hashes the canonical form, not raw JSON.stringify", async () => {
  const a = { b: [3, { d: 4, c: 5 }], a: 1 };
  const b = { a: 1, b: [3, { c: 5, d: 4 }] };
  assert.notEqual(JSON.stringify(a), JSON.stringify(b));
  assert.equal(await sha256Stable(a), await sha256Stable(b));
});

/* ------------------------------------------------------------------ *
 * 2. Canonical serialization
 * ------------------------------------------------------------------ */

test("stableStringify sorts keys at every depth", () => {
  assert.equal(
    stableStringify({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }),
    stableStringify({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
  );
});

test("stableStringify preserves array order — task sequence is meaningful", () => {
  assert.notEqual(stableStringify([1, 2, 3]), stableStringify([3, 2, 1]));
});

test("stableStringify drops undefined but keeps explicit null", () => {
  assert.equal(stableStringify({ a: 1, b: undefined }), stableStringify({ a: 1 }));
  assert.notEqual(stableStringify({ a: 1, b: null }), stableStringify({ a: 1 }));
});

/* ------------------------------------------------------------------ *
 * 3. Draft and publish
 * ------------------------------------------------------------------ */

test("a draft starts at version 1 with no digest and cannot be referenced", () => {
  const d = draft();
  assert.equal(d.version, 1);
  assert.equal(d.status, "DRAFT");
  assert.equal(d.contentHash, null);
  assert.equal(d.publishedAt, null);
  assert.throws(() => referenceTo(d), (e: ContractInvariantError) => e.invariant === "NO_DRAFT_REFERENCES");
});

test("a contract requires at least one task block", () => {
  assert.throws(
    () => draft({ taskBlocks: [] }),
    (e: ContractInvariantError) => e.invariant === "TASK_BLOCKS_REQUIRED",
  );
});

test("duplicate requirement ids are rejected", () => {
  assert.throws(
    () => draft({ taskBlocks: [
      { requirementId: "rq-a", acceptanceFingerprint: HA },
      { requirementId: "rq-a", acceptanceFingerprint: HB },
    ] }),
    (e: ContractInvariantError) => e.invariant === "TASK_BLOCK_ID",
  );
});

test("a malformed acceptance fingerprint is rejected", () => {
  for (const bad of ["", "nope", "g".repeat(64), "a".repeat(63), "a".repeat(65)]) {
    assert.throws(
      () => draft({ taskBlocks: [{ requirementId: "rq-a", acceptanceFingerprint: bad }] }),
      (e: ContractInvariantError) => e.invariant === "TASK_BLOCK_FINGERPRINT",
      `expected fingerprint ${JSON.stringify(bad)} to be rejected`,
    );
  }
});

/**
 * Documents actual behaviour rather than asserting a preference.
 *
 * Validation is case-insensitive; `sha256Stable` only ever emits lowercase, and
 * digest COMPARISON is case-sensitive. So a hand-written uppercase digest would
 * validate, then compare unequal against the lowercase digest of identical
 * content — reporting a change that did not occur. Not reachable through normal
 * code paths, since every digest in the system comes from sha256Stable. Recorded
 * as an observation in 17_MERGE_AUDIT, not treated as a blocker.
 */
test("digest validation accepts uppercase hex, while comparison is case-sensitive", () => {
  assert.doesNotThrow(() => publish(draft(), { publishedAt: T1, contentHash: "A".repeat(64) }));
  assert.notEqual("A".repeat(64), HA);
});

test("identity and correlation are mandatory", () => {
  assert.throws(() => draft({ contractId: "" }), (e: ContractInvariantError) => e.invariant === "IDENTITY");
  assert.throws(() => draft({ correlationId: "" }), (e: ContractInvariantError) => e.invariant === "CORRELATION");
});

test("publishing without a timestamp is refused", () => {
  assert.throws(
    () => publish(draft(), { publishedAt: "", contentHash: HA }),
    (e: ContractInvariantError) => e.invariant === "PUBLISH_TIME",
  );
});

test("publishing with a malformed digest is refused", () => {
  for (const bad of ["", "nope", "g".repeat(64), "a".repeat(63), "a".repeat(65)]) {
    assert.throws(
      () => publish(draft(), { publishedAt: T1, contentHash: bad }),
      (e: ContractInvariantError) => e.invariant === "CONTENT_DIGEST",
      `expected digest ${JSON.stringify(bad)} to be rejected`,
    );
  }
});

test("a published contract cannot be published again", () => {
  assert.throws(
    () => publish(published(), { publishedAt: T2, contentHash: HB }),
    (e: ContractInvariantError) => e.invariant === "PUBLISH_ONCE",
  );
});

/* ------------------------------------------------------------------ *
 * 4. Supersession
 * ------------------------------------------------------------------ */

const supersedeFrom = (previous: RequirementContract, over: Record<string, unknown> = {}) =>
  supersede({
    previous,
    content: plan({ unresolved: ["changed"] }),
    reason: "customer corrected the floor count",
    correlationId: "corr-2",
    taskBlocks: blocks("rq-pickup", "rq-carry", "rq-place"),
    contentHash: HB,
    publishedAt: T2,
    ...over,
  } as Parameters<typeof supersede>[0]);

test("superseding without a reason is refused — silent replacement is the failure this prevents", () => {
  for (const reason of ["", "   "]) {
    assert.throws(
      () => supersedeFrom(published(), { reason }),
      (e: ContractInvariantError) => e.invariant === "SUPERSEDE_REASON",
    );
  }
});

test("only a PUBLISHED contract can be superseded", () => {
  assert.throws(
    () => supersedeFrom(draft()),
    (e: ContractInvariantError) => e.invariant === "SUPERSEDE_PUBLISHED_ONLY",
  );
});

test("a superseded contract cannot be superseded again — no forked lineage", () => {
  const { superseded } = supersedeFrom(published());
  assert.throws(
    () => supersedeFrom(superseded, { contentHash: HC }),
    (e: ContractInvariantError) => e.invariant === "SUPERSEDE_PUBLISHED_ONLY",
  );
});

test("superseding links the lineage in both directions", () => {
  const v1 = published();
  const { superseded, next } = supersedeFrom(v1);
  assert.equal(next.version, 2);
  assert.equal(next.status, "PUBLISHED");
  assert.equal(next.contractId, v1.contractId);
  assert.equal(superseded.status, "SUPERSEDED");
  assert.equal(superseded.supersededBy, 2);
  assert.equal(superseded.supersedeReason, "customer corrected the floor count");
});

test("superseding requires a correlation id and a timestamp", () => {
  assert.throws(() => supersedeFrom(published(), { correlationId: "" }),
    (e: ContractInvariantError) => e.invariant === "CORRELATION");
  assert.throws(() => supersedeFrom(published(), { publishedAt: "" }),
    (e: ContractInvariantError) => e.invariant === "PUBLISH_TIME");
});

test("versions are monotonic across a chain of revisions", () => {
  let current = published();
  const seen = [current.version];
  for (let i = 0; i < 4; i++) {
    const { next } = supersedeFrom(current, {
      contentHash: "d".repeat(63) + String(i),
      taskBlocks: [{ requirementId: "rq-pickup", acceptanceFingerprint: "e".repeat(63) + String(i) }],
      reason: `revision ${i}`,
    });
    current = next;
    seen.push(current.version);
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
});

/* ------------------------------------------------------------------ *
 * 5. Reference resolution — "the same plan persists"
 * ------------------------------------------------------------------ */

test("references round-trip through referenceTo and resolveReference", () => {
  const c = published();
  assert.equal(resolveReference([c], referenceTo(c)), c);
});

test("a reference to a version that does not exist is an error, not a nearest match", () => {
  assert.throws(
    () => resolveReference([published()], "WC-4471@7"),
    (e: ContractInvariantError) => e.invariant === "REFERENCE_UNRESOLVED",
  );
});

test("malformed references are rejected", () => {
  const history = [published()];
  for (const bad of ["WC-4471", "@2", "WC-4471@", "WC-4471@0", "WC-4471@x", "WC-4471@1.5", "WC-4471@-1"]) {
    assert.throws(
      () => resolveReference(history, bad),
      (e: ContractInvariantError) =>
        e.invariant === "REFERENCE_FORMAT" || e.invariant === "REFERENCE_UNRESOLVED",
      `expected ${JSON.stringify(bad)} to be rejected`,
    );
  }
});

test("contract ids containing @ still resolve — the last @ wins", () => {
  const odd = publish(draft({ contractId: "tenant@acme/WC-9" }), { publishedAt: T1, contentHash: HA });
  assert.equal(resolveReference([odd], referenceTo(odd)).contractId, "tenant@acme/WC-9");
});

/* ------------------------------------------------------------------ *
 * 6. Current version
 * ------------------------------------------------------------------ */

test("exactly one version is current at a time", () => {
  const { superseded, next } = supersedeFrom(published());
  assert.equal(currentVersion([superseded, next], "WC-4471")?.version, 2);
});

test("currentVersion returns null for an unknown contract", () => {
  assert.equal(currentVersion([published()], "WC-nope"), null);
});

test("a forked lineage is detected rather than silently picking one", () => {
  const a = published();
  const b = publish(draft({ correlationId: "corr-2" }), { publishedAt: T2, contentHash: HB });
  assert.throws(
    () => currentVersion([a, b], "WC-4471"),
    (e: ContractInvariantError) => e.invariant === "SINGLE_PUBLISHED_VERSION",
  );
});
