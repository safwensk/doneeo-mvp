import test from "node:test";
import assert from "node:assert/strict";

import {
  ContractInvariantError,
  assignFulfillment,
  beginExecution,
  carryLifecycleForward,
  contentChanged,
  currentVersion,
  deepFrozenClone,
  draftContract,
  initializeLifecycle,
  publish,
  referenceTo,
  releaseFulfillment,
  resolveReference,
  stableStringify,
  supersede,
} from "../lib/requirement-contract";
import { fingerprintTaskBlocks, sha256Stable, type TaskBlockAcceptanceProjection } from "../lib/application/requirement-contract-hashing";
import type { JobIntelligence } from "../lib/planner";

function plan(overrides: Partial<JobIntelligence> = {}): JobIntelligence {
  return {
    version: "1",
    facts: [], primitives: [], resources: [], workstreams: [],
    fulfillment: { mode: "single_team", singleCustomerOrder: true, rationale: "one team", groups: [] },
    manpower: { minimum: 2, recommended: 2, reason: "safe handling", alternatives: [] },
    estimate: { ready: true, personMinutes: 120, executionMinutes: 60, accessMinutes: 7, routeMinutes: 18, bufferMinutes: 10, totalMinutes: 95, rangeLow: 80, rangeHigh: 110, equation: "work + access + travel + buffer", assumptions: ["fits"] },
    confidence: { level: "high", score: 90, reason: "resolved" }, unresolved: [],
    ...overrides,
  } as JobIntelligence;
}

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T11:30:00.000Z";

function projection(requirementId: string, scope = "carry couch", crew = 2): TaskBlockAcceptanceProjection {
  return {
    requirementId,
    scope,
    qualification: "general_helper",
    crew: { minimum: crew, recommended: crew },
    duration: { likelyMinutes: 60, rangeLow: 45, rangeHigh: 90 },
    equipmentAndMaterials: ["dolly", "straps"],
    accessAndLocations: ["3rd floor", "no elevator"],
    temporalConstraints: ["arrive 10:00"],
    dependencies: [],
    completionCriteria: ["placed undamaged"],
    ruleDecisions: ["safe-lift-v1"],
  };
}

async function published() {
  const content = plan();
  const taskBlocks = await fingerprintTaskBlocks([projection("rq-carry")]);
  const draft = draftContract({ contractId: "WC-4471", content, correlationId: "corr-1", taskBlocks });
  return publish(draft, { publishedAt: T1, contentHash: await sha256Stable(content) });
}

test("stable serialization is key-order insensitive but array-order sensitive", () => {
  assert.equal(stableStringify({ b: 1, a: { d: 2, c: [3, 4] } }), stableStringify({ a: { c: [3, 4], d: 2 }, b: 1 }));
  assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
});

test("publication uses a verifiable SHA-256 digest", async () => {
  assert.equal(await sha256Stable("a"), "ac8d8342bbb2362d13f0a559a3621bb407011368895164b628a54f7fc33fc43c");
  const digest = await sha256Stable({ hello: "world" });
  assert.match(digest, /^[0-9a-f]{64}$/);
});

test("published snapshot is deeply immutable without freezing the caller's source object", async () => {
  const source = plan({ estimate: { ...plan().estimate, assumptions: ["original"] } });
  const blocks = await fingerprintTaskBlocks([projection("rq-carry")]);
  const contract = publish(draftContract({ contractId: "WC-1", content: source, correlationId: "c", taskBlocks: blocks }), { publishedAt: T1, contentHash: await sha256Stable(source) });
  assert.ok(Object.isFrozen(contract));
  assert.ok(Object.isFrozen(contract.content));
  assert.ok(Object.isFrozen(contract.content.estimate.assumptions));
  assert.throws(() => contract.content.estimate.assumptions.push("mutate"), TypeError);
  source.estimate.assumptions.push("caller still mutable");
  assert.deepEqual(contract.content.estimate.assumptions, ["original"]);
});

test("provider assignment is downstream lifecycle state and never changes the contract", async () => {
  const contract = await published();
  const before = JSON.stringify(contract);
  const lifecycle = assignFulfillment(initializeLifecycle(contract), "rq-carry", "flf-marc");
  assert.equal(lifecycle[0].fulfillmentId, "flf-marc");
  assert.equal(JSON.stringify(contract), before);
  assert.equal(contract.contentHash, await sha256Stable(contract.content));
});

test("provider decline clears fulfillment while requirement identity survives", async () => {
  const contract = await published();
  const assigned = assignFulfillment(initializeLifecycle(contract), "rq-carry", "flf-david");
  const released = releaseFulfillment(assigned, "rq-carry");
  assert.equal(released[0].requirementId, "rq-carry");
  assert.equal(released[0].fulfillmentId, null);
});

test("execution requires fulfillment", async () => {
  const contract = await published();
  assert.throws(() => beginExecution(initializeLifecycle(contract), "rq-carry", "exe-1"), (e: ContractInvariantError) => e.invariant === "EXECUTION_REQUIRES_FULFILLMENT");
});

test("unchanged task fingerprint carries provider acceptance across an unrelated contract change", async () => {
  const v1 = await published();
  const assigned = assignFulfillment(initializeLifecycle(v1), "rq-carry", "flf-marc");
  const nextContent = plan({ confidence: { level: "medium", score: 70, reason: "unrelated non-accepted confidence update" } });
  const sameBlocks = await fingerprintTaskBlocks([projection("rq-carry")]);
  const { next } = supersede({ previous: v1, content: nextContent, contentHash: await sha256Stable(nextContent), reason: "confidence provenance updated", correlationId: "c2", taskBlocks: sameBlocks, publishedAt: T2 });
  const carried = carryLifecycleForward(assigned, next);
  assert.equal(carried[0].fulfillmentId, "flf-marc");
});

test("material accepted-scope change clears provider and execution identities only for the changed task", async () => {
  const content = plan();
  const blocks = await fingerprintTaskBlocks([projection("rq-a", "carry couch"), projection("rq-b", "mount TV", 1)]);
  const v1 = publish(draftContract({ contractId: "WC-2", content, correlationId: "c", taskBlocks: blocks }), { publishedAt: T1, contentHash: await sha256Stable(content) });
  let lifecycle = initializeLifecycle(v1);
  lifecycle = assignFulfillment(lifecycle, "rq-a", "flf-a");
  lifecycle = assignFulfillment(lifecycle, "rq-b", "flf-b");
  lifecycle = beginExecution(lifecycle, "rq-b", "exe-b");

  const changedContent = plan({ manpower: { minimum: 3, recommended: 3, reason: "larger couch", alternatives: [] } });
  const nextBlocks = await fingerprintTaskBlocks([projection("rq-a", "carry sectional", 3), projection("rq-b", "mount TV", 1)]);
  const { next } = supersede({ previous: v1, content: changedContent, contentHash: await sha256Stable(changedContent), reason: "customer corrected couch size", correlationId: "c2", taskBlocks: nextBlocks, publishedAt: T2 });
  const carried = carryLifecycleForward(lifecycle, next);
  assert.equal(carried.find(x => x.requirementId === "rq-a")?.fulfillmentId, null);
  assert.equal(carried.find(x => x.requirementId === "rq-b")?.fulfillmentId, "flf-b");
  assert.equal(carried.find(x => x.requirementId === "rq-b")?.executionId, "exe-b");
});

test("identical re-plan is rejected rather than creating a spurious version", async () => {
  const v1 = await published();
  const sameBlocks = await fingerprintTaskBlocks([projection("rq-carry")]);
  assert.throws(() => supersede({ previous: v1, content: plan(), contentHash: v1.contentHash!, reason: "rerun", correlationId: "c2", taskBlocks: sameBlocks, publishedAt: T2 }), (e: ContractInvariantError) => e.invariant === "NO_MATERIAL_CHANGE");
});

test("exact version references remain resolvable after supersession", async () => {
  const v1 = await published();
  const changed = plan({ unresolved: ["new fact"] });
  const blocks = await fingerprintTaskBlocks([projection("rq-carry", "carry couch carefully")]);
  const step = supersede({ previous: v1, content: changed, contentHash: await sha256Stable(changed), reason: "material fact", correlationId: "c2", taskBlocks: blocks, publishedAt: T2 });
  const ref = referenceTo(step.superseded);
  assert.equal(resolveReference([step.superseded, step.next], ref).version, 1);
  assert.equal(currentVersion([step.superseded, step.next], "WC-4471")?.version, 2);
  assert.equal(contentChanged(step.superseded, step.next), true);
});

test("deepFrozenClone freezes nested arrays and objects", () => {
  const value = deepFrozenClone({ a: [{ b: 1 }] });
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.a));
  assert.ok(Object.isFrozen(value.a[0]));
});
