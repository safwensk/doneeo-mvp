/**
 * The Montréal pilot policy.
 *
 * Two jobs here: check the ladder behaves at its boundaries, and check that
 * putting numbers in this file did not let numbers leak back into the layers.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  MONTREAL_PILOT, MONTREAL_PILOT_COMMITMENT_POLICY as POLICY,
  MONTREAL_PILOT_REVIEW_POLICY as REVIEW,
  MONTREAL_PILOT_IMPACT_CLASSIFIER as CLASSIFIER,
  CAPACITY_LOCK_LEAD_MINUTES, REVIEW_THRESHOLD_NET_LOST_MINUTES,
} from "../lib/policy/montreal-pilot";
import type { EligibleCostKind } from "../lib/layers/l7/commitment";
import type { ChangedFact, FieldObservation } from "../lib/layers/l09a/reality";

const START = "2026-09-10T14:00:00.000Z";
/** now, expressed as minutes before START. */
const before = (minutes: number) => new Date(Date.parse(START) - minutes * 60_000).toISOString();

function stage(over: Partial<Parameters<typeof POLICY.stageOf>[0]> = {}) {
  return POLICY.stageOf({
    now: before(48 * 60), startsAt: START,
    providerAccepted: true, capacityHeld: true,
    mobilizationStarted: false, workStarted: false, ...over,
  });
}

const obs: FieldObservation = {
  observationId: "OB-1", taskId: "T-1", observedAt: START,
  observedBy: "executor-7", statement: "panel is not where the plan says",
  evidenceRefs: ["photo-1"],
};
function fact(factKey: string): ChangedFact {
  return { factKey, supersededValue: "a", newValue: "b", source: "FIELD_OBSERVATION", evidenceRefs: ["photo-1"], changedAt: START };
}
const classify = (facts: ChangedFact[]) =>
  CLASSIFIER.classify({ observation: obs, changedFacts: facts, plannedStatement: "replace the panel" });

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

test("nothing accepted yet is free", () => {
  assert.equal(stage({ providerAccepted: false, capacityHeld: false }), "FREE_OR_LOW");
});

test("a provider accepting begins commitment, but does not lock capacity", () => {
  assert.equal(stage({ capacityHeld: false }), "COMMITMENT_BEGINS");
});

test("capacity locks exactly at the 24-hour boundary, not a minute earlier", () => {
  assert.equal(stage({ now: before(CAPACITY_LOCK_LEAD_MINUTES + 1) }), "COMMITMENT_BEGINS",
    "one minute outside the window is still free");
  assert.equal(stage({ now: before(CAPACITY_LOCK_LEAD_MINUTES) }), "CAPACITY_LOCKED",
    "the boundary itself is inside the lock");
  assert.equal(stage({ now: before(CAPACITY_LOCK_LEAD_MINUTES - 1) }), "CAPACITY_LOCKED");
});

test("the clock cannot lock capacity that was never held", () => {
  assert.equal(stage({ now: before(1), capacityHeld: false }), "COMMITMENT_BEGINS",
    "an hour before start with no capacity held is not a locked slot");
});

test("physical facts outrank the clock", () => {
  // Three weeks out, but someone is already driving.
  assert.equal(stage({ now: before(21 * 24 * 60), mobilizationStarted: true }), "MOBILIZED");
  assert.equal(stage({ now: before(21 * 24 * 60), workStarted: true }), "WORK_STARTED");
});

test("a past start time is locked, not unlocked", () => {
  assert.equal(stage({ now: new Date(Date.parse(START) + 60_000).toISOString() }), "CAPACITY_LOCKED",
    "negative time-to-start must not fall through to a free stage");
});

test("unparseable timestamps fail loudly rather than defaulting to free", () => {
  assert.throws(() => stage({ now: "not-a-date" }), /unparseable/);
});

// ---------------------------------------------------------------------------
// Cost eligibility
// ---------------------------------------------------------------------------

test("the free stage protects nothing at all", () => {
  const kinds: EligibleCostKind[] = ["PREPARATION", "MOBILIZATION", "ACTUAL_WORK", "NET_LOST_CAPACITY", "EXTERNAL"];
  for (const k of kinds) {
    assert.equal(POLICY.isCostEligible(k, "FREE_OR_LOW"), false, `${k} must not be eligible before commitment`);
  }
});

test("eligibility only ever grows as the ladder is climbed", () => {
  const ladder = ["FREE_OR_LOW", "COMMITMENT_BEGINS", "CAPACITY_LOCKED", "MOBILIZED", "WORK_STARTED"] as const;
  const kinds: EligibleCostKind[] = ["PREPARATION", "MOBILIZATION", "ACTUAL_WORK", "NET_LOST_CAPACITY", "EXTERNAL"];
  for (const k of kinds) {
    let seenEligible = false;
    for (const s of ladder) {
      const eligible = POLICY.isCostEligible(k, s);
      if (eligible) seenEligible = true;
      assert.ok(!(seenEligible && !eligible), `${k} became eligible then stopped being so at ${s}`);
    }
  }
});

test("lost capacity is not protected until the slot could no longer be rebooked", () => {
  assert.equal(POLICY.isCostEligible("NET_LOST_CAPACITY", "COMMITMENT_BEGINS"), false);
  assert.equal(POLICY.isCostEligible("NET_LOST_CAPACITY", "CAPACITY_LOCKED"), true);
});

test("travel time is protected only once someone is travelling", () => {
  assert.equal(POLICY.isCostEligible("MOBILIZATION", "CAPACITY_LOCKED"), false);
  assert.equal(POLICY.isCostEligible("MOBILIZATION", "MOBILIZED"), true);
});

test("work performed is protected only once work began", () => {
  assert.equal(POLICY.isCostEligible("ACTUAL_WORK", "MOBILIZED"), false);
  assert.equal(POLICY.isCostEligible("ACTUAL_WORK", "WORK_STARTED"), true);
});

// ---------------------------------------------------------------------------
// Escalation to review
// ---------------------------------------------------------------------------

test("disputed and safety cases always go to a person", () => {
  const base = { stage: "CAPACITY_LOCKED" as const, cause: "CUSTOMER_VOLUNTARY" as const, netLostMinutes: 30, disputed: false };
  assert.equal(POLICY.requiresResponsibilityReview({ ...base, disputed: true }), true);
  assert.equal(POLICY.requiresResponsibilityReview({ ...base, cause: "SAFETY_OR_REGULATORY" }), true);
  assert.equal(POLICY.requiresResponsibilityReview(base), false, "a small clear case settles by policy");
});

test("review threshold is a strict crossing, not a rounding", () => {
  const at = (netLostMinutes: number) => POLICY.requiresResponsibilityReview({
    stage: "CAPACITY_LOCKED", cause: "CUSTOMER_VOLUNTARY", netLostMinutes, disputed: false,
  });
  assert.equal(at(REVIEW_THRESHOLD_NET_LOST_MINUTES), false, "exactly at the threshold still settles");
  assert.equal(at(REVIEW_THRESHOLD_NET_LOST_MINUTES + 1), true);
});

test("a provider walking away after mobilisation is escalated regardless of size", () => {
  const base = { cause: "PROVIDER_WITHDRAWAL" as const, netLostMinutes: 5, disputed: false };
  assert.equal(POLICY.requiresResponsibilityReview({ ...base, stage: "CAPACITY_LOCKED" }), false);
  assert.equal(POLICY.requiresResponsibilityReview({ ...base, stage: "MOBILIZED" }), true);
  assert.equal(POLICY.requiresResponsibilityReview({ ...base, stage: "WORK_STARTED" }), true);
});

test("both parties responsible is reviewed, not allocated", () => {
  const r = REVIEW.requiresReview({
    cause: "CUSTOMER_INACCURATE_OR_OMITTED_FACT", disputed: false,
    customerEstablished: true, doneeoEstablished: true,
  });
  assert.equal(r.required, true);
  assert.match(r.reason ?? "", /both independently responsible|by hand/);
});

// ---------------------------------------------------------------------------
// The provisional classifier — OR-1
// ---------------------------------------------------------------------------

test("no changed facts confirms the plan", () => {
  const c = classify([]);
  assert.equal(c.impact, "R0");
  assert.equal(c.needsHumanReview, false);
});

test("namespaced facts classify without a person", () => {
  assert.equal(classify([fact("safety.gas_line_present")]).impact, "R4");
  assert.equal(classify([fact("equipment.lift_unavailable")]).impact, "R2");
  assert.equal(classify([fact("access.stair_width")]).impact, "R1");
  assert.equal(classify([fact("requirement.panel_amperage")]).impact, "R3");
  assert.equal(classify([fact("independent.garage_door_broken")]).impact, "R5");
});

test("safety holds scope even when other facts changed too", () => {
  const c = classify([fact("equipment.lift_unavailable"), fact("safety.asbestos_suspected")]);
  assert.equal(c.impact, "R4", "safety presence decides, it does not outrank on severity");
  assert.equal(c.needsHumanReview, false);
});

test("the classifier will not read the executor's prose", () => {
  // The statement mentions a panel; the fact key is unrecognised. It must not
  // infer a requirement change from the words.
  const c = classify([fact("mystery_key")]);
  assert.equal(c.impact, "R1");
  assert.equal(c.needsHumanReview, true);
  assert.match(c.rationale, /OR-1|free text/);
});

test("mixed mismatch kinds are parked, because choosing between them is OR-1", () => {
  const c = classify([fact("equipment.lift_unavailable"), fact("requirement.panel_amperage")]);
  assert.equal(c.needsHumanReview, true);
  assert.match(c.rationale, /OR-1/);
});

test("R3 and R5 always record that they sit on the billing boundary", () => {
  for (const key of ["requirement.panel_amperage", "independent.garage_door_broken"]) {
    assert.match(classify([fact(key)]).rationale, /OR-1|charged/,
      "the class that decides billability must say it is provisional");
  }
});

test("every classification carries a rationale", () => {
  const cases = [[], [fact("safety.x")], [fact("mystery")], [fact("equipment.a"), fact("requirement.b")]];
  for (const facts of cases) {
    assert.ok(classify(facts).rationale.trim().length > 15, "an unexplained classification is not auditable");
  }
});

// ---------------------------------------------------------------------------
// The layers must stay free of what this file contains
// ---------------------------------------------------------------------------

test("no threshold leaked from this policy back into the layers", async () => {
  const { readFileSync } = await import("node:fs");
  const files = [
    "lib/layers/l7/commitment.ts", "lib/layers/l7/cancellation.ts",
    "lib/layers/l09a/reality.ts", "lib/layers/l09a/recovery.ts",
    "lib/layers/l09b/responsibility.ts", "lib/layers/l09b/allocation.ts",
  ];
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!src.includes("montreal") && !src.includes("MONTREAL"),
      `${f} names a specific policy; layers must work with any`);
    // Note the _LEAD suffix: CAPACITY_LOCKED is a legitimate stage name and
    // must not trip this check. Only the pilot's constants are forbidden.
    assert.ok(!/\b24\s*\*\s*60\b|CAPACITY_LOCK_LEAD|REVIEW_THRESHOLD_NET_LOST/.test(src),
      `${f} contains a pilot threshold`);
    // No bare time arithmetic either — that is how a window sneaks back in.
    assert.ok(!/60_000|60 \* 1000|getTime\(\)|Date\.parse/.test(src),
      `${f} does arithmetic on time; the policy port exists so it does not have to`);
  }
});

test("the pilot exposes its numbers so they can be shown to a customer", () => {
  assert.equal(MONTREAL_PILOT.capacityLockLeadMinutes, 24 * 60);
  assert.equal(MONTREAL_PILOT.reviewThresholdNetLostMinutes, 8 * 60);
  assert.equal(MONTREAL_PILOT.name, "montreal-pilot");
});
