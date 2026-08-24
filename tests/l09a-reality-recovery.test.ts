/**
 * L09A — Reality & Recovery Decision.
 *
 * The three golden scenarios for this layer, plus the invariants every
 * superseded 09A poster got wrong — chiefly that R0–R5 are semantic classes and
 * not a severity ladder.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  openRealityCase, recordObservation, unaffectedTaskIds, classesPresent,
  IMPACT_CLASSES, RealityInvariantError,
  type ChangedFact, type FieldObservation, type ImpactClass, type ImpactClassifier,
} from "../lib/layers/l09a/reality";
import {
  decideRecovery, candidateFollowUpFrom, markUnrecoverable, RECOVERY_HIERARCHY,
  type RecoveryOption, type RecoveryOptionKind, type RecoverySearch,
} from "../lib/layers/l09a/recovery";

const T = "2026-09-02T10:15:00.000Z";

function obs(over: Partial<FieldObservation> = {}): FieldObservation {
  return {
    observationId: "OB-1", taskId: "T-install", observedAt: T, observedBy: "P-1",
    statement: "The supply connection does not match the appliance fitting",
    evidenceRefs: ["photo-1"], ...over,
  };
}
/** The classifier is a port precisely because OR-1 is unresolved. Tests pin it. */
function classifier(impact: ImpactClass, taskId = "T-install"): ImpactClassifier {
  return { classify: () => ({ taskId, impact, rationale: `pinned ${impact} for test`, needsHumanReview: false }) };
}
function caseWith(impact: ImpactClass, o: FieldObservation = obs(), facts: ChangedFact[] = []) {
  return recordObservation({
    realityCase: openRealityCase({ realityCaseId: "RC-1", workCaseId: "WC-1", jobOrderId: "JO-1", now: T }),
    observation: o, changedFacts: facts, plannedStatement: "standard install",
    classifier: classifier(impact, o.taskId),
  });
}
/** A search where only the named option is viable. */
function searchWhere(viableKind: RecoveryOptionKind | null, over: Partial<RecoveryOption> = {}): RecoverySearch {
  return {
    evaluate: ({ kind, affectedTaskIds }) => ({
      kind, taskIds: affectedTaskIds, viable: kind === viableKind,
      reason: kind === viableKind ? "available" : "not available",
      changesRequirement: false, needsCustomerApproval: false, ...over,
    }),
  };
}
const ALL = ["T-pickup", "T-deliver", "T-install"];
const DEPS = { "T-deliver": ["T-pickup"], "T-install": ["T-deliver"] };

// ---------------------------------------------------------------------------
// Golden regression scenarios
// ---------------------------------------------------------------------------

test("L09A-G1 · R2 missing tool resolved without RC change", () => {
  const rc = caseWith("R2", obs({ statement: "The torque wrench is not in the van" }));
  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS,
    search: searchWhere("SMALL_RESOURCE_ADJUSTMENT"),
  });

  assert.equal(d.selected?.kind, "SMALL_RESOURCE_ADJUSTMENT");
  assert.equal(d.selected?.changesRequirement, false, "R2 must not change the RequirementContract");
  assert.ok(d.routeTo.includes("L4_L5_RESOURCE_RECOVERY"));
  assert.ok(!d.routeTo.includes("L2_TARGETED_REANALYSIS"),
    "a resource variance must never trigger reanalysis — the requirement still holds");
});

test("L09A-G2 · R3 incompatible connection produces RC vN+1 only for affected task", () => {
  const rc = caseWith("R3");
  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS,
    search: searchWhere("TARGETED_REARCHITECTURE", { changesRequirement: true }),
  });

  assert.ok(d.routeTo.includes("L2_TARGETED_REANALYSIS"));
  assert.deepEqual(d.selected?.taskIds, ["T-install"], "only the affected task is rearchitected");
  // Everything not downstream of the affected task keeps running.
  assert.deepEqual([...d.continuingTaskIds].sort(), ["T-deliver", "T-pickup"]);
  assert.ok(!d.routeTo.includes("L7_RESCHEDULE_OR_CANCEL"));
});

test("L09A-G3 · R5 unrelated faucet repair remains CandidateFollowUp", () => {
  const rc = caseWith("R5", obs({ observationId: "OB-9", statement: "The kitchen faucet is dripping" }));
  const follow = candidateFollowUpFrom(rc, "OB-9");

  assert.equal(follow.consented, false);
  assert.equal(follow.inCurrentScope, false, "independent work is never current billable scope");
  assert.ok(!JSON.stringify(follow).toLowerCase().match(/price|amount|cost|fee/),
    "a CandidateFollowUp must carry no price");

  // And it does not stop the job it was noticed during.
  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS, search: searchWhere("CURRENT_EXECUTOR"),
  });
  assert.deepEqual([...d.continuingTaskIds].sort(), ["T-deliver", "T-install", "T-pickup"]);
  assert.ok(d.routeTo.includes("L13_BRANCH"));
});

// ---------------------------------------------------------------------------
// Non-negotiable invariants
// ---------------------------------------------------------------------------

test("R0–R5 are semantic classes, not a severity ladder", async () => {
  // Every superseded 09A variant encoded these as severity. The module must
  // expose no ordering, no rank and no comparison.
  const { readFileSync } = await import("node:fs");
  const src = ["lib/layers/l09a/reality.ts", "lib/layers/l09a/recovery.ts"]
    .map(f => readFileSync(new URL(`../${f}`, import.meta.url), "utf-8"))
    // strip block and line comments so this checks code, not prose about code
    .map(t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))
    .join("\n");
  for (const bad of ["severity", "R0 <", "R5 >", "rank", "escalationLevel"]) {
    assert.ok(!src.includes(bad), `L09A must not encode impact as ${bad}`);
  }
  // The reference table describes routing, never degree.
  for (const c of Object.values(IMPACT_CLASSES)) {
    assert.ok(c.routesTo.length > 0);
    assert.ok(!/worse|higher|lower|more severe/i.test(c.meaning + c.routesTo));
  }
});

test("R4 holds the smallest safe scope immediately, before any recovery search", () => {
  const rc = caseWith("R4", obs({ statement: "Live wiring behind the panel, unlabelled" }));
  assert.deepEqual(rc.heldTaskIds, ["T-install"], "the affected task is held on classification alone");
  assert.deepEqual(classesPresent(rc), ["R4"]);

  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS, search: searchWhere("CONTINUE_UNAFFECTED"),
  });
  assert.ok(d.routeTo.includes("L3_SAFETY_RECLASSIFICATION"), "R4 always reaches L3");
  assert.ok(d.heldTaskIds.includes("T-install"));
  assert.ok(!d.continuingTaskIds.includes("T-install"), "a held task cannot continue");
});

test("unaffected TaskBlocks continue; dependents of an affected task do not", () => {
  const rc = caseWith("R3", obs({ taskId: "T-deliver" }));
  const continuing = unaffectedTaskIds({ realityCase: rc, allTaskIds: ALL, dependsOn: DEPS });
  assert.deepEqual(continuing, ["T-pickup"],
    "pickup is upstream and continues; install depends on delivery and cannot");
});

test("solution before broad replanning — last resort is unreachable while anything else works", () => {
  const rc = caseWith("R3");
  // A search where BOTH a preserving option and a last-resort option are viable.
  const greedy: RecoverySearch = {
    evaluate: ({ kind, affectedTaskIds }) => ({
      kind, taskIds: affectedTaskIds,
      viable: kind === "REPLACE_ROLE" || kind === "FULL_REPLAN",
      reason: "viable", changesRequirement: false, needsCustomerApproval: false,
    }),
  };
  const d = decideRecovery({ realityCase: rc, allTaskIds: ALL, dependsOn: DEPS, search: greedy });
  assert.equal(d.selected?.kind, "REPLACE_ROLE", "the preserving option must win");
  assert.ok(!d.considered.some(o => o.kind === "FULL_REPLAN"),
    "a full replan must not even be considered while a preserving option is viable");
});

test("full replan and cancellation are reachable when nothing else is", () => {
  const rc = caseWith("R3");
  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS, search: searchWhere("FULL_REPLAN"),
  });
  assert.equal(d.selected?.kind, "FULL_REPLAN");
  assert.ok(d.considered.length > 1, "the hierarchy above it must have been tried first");
});

test("no viable recovery routes to L7 and marks the case unrecoverable", () => {
  const rc = caseWith("R3");
  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS, search: searchWhere(null),
  });
  assert.equal(d.selected, null);
  assert.equal(d.unrecoverable, true);
  assert.ok(d.routeTo.includes("L7_RESCHEDULE_OR_CANCEL"),
    "L7 consumes RealityCase.Unrecoverable — this is that seam");
  assert.equal(markUnrecoverable(rc).status, "UNRECOVERABLE");
});

test("the search is walked in canonical hierarchy order", () => {
  const seen: RecoveryOptionKind[] = [];
  const rc = caseWith("R2");
  decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS,
    search: { evaluate: ({ kind, affectedTaskIds }) => {
      seen.push(kind);
      return { kind, taskIds: affectedTaskIds, viable: kind === "ADD_SPECIALIST",
               reason: "", changesRequirement: false, needsCustomerApproval: false };
    } },
  });
  assert.deepEqual(seen, RECOVERY_HIERARCHY.slice(0, 4),
    "options must be offered in order and the search must stop at the first viable one");
});

test("the executor reports facts, not blame or priced scope", () => {
  const o = obs();
  const keys = Object.keys(o).join(" ").toLowerCase();
  for (const bad of ["fault", "blame", "price", "cost", "amount", "liable"]) {
    assert.ok(!keys.includes(bad), `a FieldObservation must not carry ${bad}`);
  }
});

test("a changed fact keeps the superseded value and must actually differ", () => {
  const f: ChangedFact = {
    factKey: "supply.fitting", supersededValue: "15mm compression", newValue: "12mm push-fit",
    source: "FIELD_OBSERVATION", evidenceRefs: ["photo-2"], changedAt: T,
  };
  const rc = caseWith("R3", obs(), [f]);
  assert.equal(rc.changedFacts[0]!.supersededValue, "15mm compression",
    "provenance is append-only; the planned value must survive");

  assert.throws(
    () => caseWith("R3", obs(), [{ ...f, supersededValue: "12mm push-fit" }]),
    (e: unknown) => e instanceof RealityInvariantError && e.invariant === "NOT_A_CHANGE",
  );
});

test("a classification without a rationale is refused", () => {
  assert.throws(
    () => recordObservation({
      realityCase: openRealityCase({ realityCaseId: "RC-1", workCaseId: "WC-1", jobOrderId: "JO-1", now: T }),
      observation: obs(), changedFacts: [], plannedStatement: "x",
      classifier: { classify: () => ({ taskId: "T-install", impact: "R3", rationale: "  ", needsHumanReview: false }) },
    }),
    (e: unknown) => e instanceof RealityInvariantError && e.invariant === "RATIONALE_REQUIRED",
  );
});

test("only R5 can become a CandidateFollowUp", () => {
  const rc = caseWith("R3", obs({ observationId: "OB-3" }));
  assert.throws(
    () => candidateFollowUpFrom(rc, "OB-3"),
    (e: unknown) => e instanceof RealityInvariantError && e.invariant === "NOT_INDEPENDENT_WORK",
    "requirement-impacting work is in scope and must not be reclassified as a follow-up",
  );
});

test("L09A never decides who pays", () => {
  const rc = caseWith("R3");
  const d = decideRecovery({
    realityCase: rc, allTaskIds: ALL, dependsOn: DEPS, search: searchWhere("REPLACE_ROLE"),
  });
  const json = JSON.stringify(d).toLowerCase();
  for (const bad of ["responsib", "liable", "payable", "charge", "price", "amount"]) {
    assert.ok(!json.includes(bad), `L09A must not allocate economics; found "${bad}"`);
  }
  // It may only route the question to the layer that owns it.
  assert.ok(!d.routeTo.includes("L09B_RESPONSIBILITY") || rc.classifications.length > 0);
});
