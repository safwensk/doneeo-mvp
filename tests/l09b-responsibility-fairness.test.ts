/**
 * L09B — Responsibility & Fairness Economic.
 *
 * The three golden scenarios, plus the invariants that make this layer worth
 * having: no weighted blame, three independent quantities, and a customer who
 * is never charged by default.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  assessResponsibility, customerResponsibilityEstablished, providerProtectionEligible,
  doneeoResponsible, FairnessInvariantError,
  type Cause, type CustomerFactTest, type DoneeoControlTest,
  type ProviderPerformanceTest, type ReviewPolicy,
} from "../lib/layers/l09b/responsibility";
import { allocate, protectedProviderPayable } from "../lib/layers/l09b/allocation";
import type { EligibleCost } from "../lib/layers/l7/cancellation";

const EV = ["photo-1", "measurement-2"];

const customerAtFault: CustomerFactTest = {
  materialFact: true, doneeoAskedOrDisclosedImportance: true, customerCouldReasonablyKnow: true,
  inaccurateOrOmitted: true, causalLink: true,
  doneeoShouldHaveAsked: false, doneeoIgnoredContradictoryEvidence: false,
};
const noCustomerFault: CustomerFactTest = { ...customerAtFault, materialFact: false };
const providerPerformed: ProviderPerformanceTest = {
  metObligations: true, preparedAsAgreed: true, executedAsAgreed: true, evidenceRefs: EV,
};
const doneeoClean: DoneeoControlTest = {
  planningError: false, systemOrMarketplaceFailure: false, partnerFailureUnderDoneeoContract: false,
};
const noReview: ReviewPolicy = { requiresReview: () => ({ required: false, reason: null }) };

function assess(over: Partial<Parameters<typeof assessResponsibility>[0]> = {}) {
  return assessResponsibility({
    realityCaseId: "RC-1", cause: "CUSTOMER_INACCURATE_OR_OMITTED_FACT",
    customerTest: customerAtFault, providerTest: providerPerformed, doneeoTest: doneeoClean,
    disputed: false, evidenceRefs: EV, policy: noReview, ...over,
  });
}
/** Two roles blocked: 240 reserved each, lead fully rebooked, helper not. */
const twoRoleCosts: EligibleCost[] = [
  { kind: "MOBILIZATION", role: "lead", minutes: 45 },
  { kind: "MOBILIZATION", role: "helper", minutes: 45 },
  { kind: "NET_LOST_CAPACITY", role: "helper", minutes: 240 },
  { kind: "EXTERNAL", role: "lead", externalCostRef: "RCPT-1" },
];

// ---------------------------------------------------------------------------
// Golden regression scenarios
// ---------------------------------------------------------------------------

test("L09B-G1 · Two-person blocked job computes protection per role", () => {
  const ppp = protectedProviderPayable({ assessment: assess(), eligibleCosts: twoRoleCosts });
  assert.deepEqual(ppp.byRole, { lead: 45, helper: 285 },
    "protection is calculated per assigned role, never as a job-level lump");
  assert.equal(ppp.minutes, 330);
  assert.deepEqual(ppp.externalCostRefs, ["RCPT-1"]);
});

test("L09B-G2 · Customer inaccurate known fact causes eligible disruption charge but not full job price", () => {
  const a = assess();
  assert.equal(a.customer.established, true);
  const out = allocate({ assessment: a, eligibleCosts: twoRoleCosts });

  // The customer bears the evidenced disruption...
  assert.ok(out.customerRealityAdjustment.minutes > 0);
  assert.deepEqual(out.customerRealityAdjustment.byRole, { lead: 45, helper: 285 });
  // ...and nothing that was never performed.
  assert.equal(out.chargesUnperformedWork, false);
  const json = JSON.stringify(out).toLowerCase();
  for (const bad of ["price", "amount", "currency", "fee", "total$"]) {
    assert.ok(!json.includes(bad), `L09B allocates, it does not price; found "${bad}"`);
  }
});

test("L09B-G3 · Doneeo planning error — provider protected, customer not charged", () => {
  const a = assess({
    cause: "DONEEO_PLANNING_ERROR",
    doneeoTest: { ...doneeoClean, planningError: true },
  });
  const out = allocate({ assessment: a, eligibleCosts: twoRoleCosts });

  assert.equal(out.customerRealityAdjustment.minutes, 0,
    "a Doneeo planning error must never become a customer surcharge");
  assert.equal(out.doneeoAbsorption.minutes, 330, "the platform carries its own error");
  // And the provider is still made whole — protection follows performance.
  const ppp = protectedProviderPayable({ assessment: a, eligibleCosts: twoRoleCosts });
  assert.equal(ppp.minutes, 330);
});

// ---------------------------------------------------------------------------
// Non-negotiable invariants
// ---------------------------------------------------------------------------

test("there is no weighted blame engine", async () => {
  const { readFileSync } = await import("node:fs");
  const src = ["lib/layers/l09b/responsibility.ts", "lib/layers/l09b/allocation.ts"]
    .map(f => readFileSync(new URL(`../${f}`, import.meta.url), "utf-8"))
    .map(t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))
    .join("\n");
  for (const bad of ["weight", "share", "percent", "contribution", "* 0.", "/ 100"]) {
    assert.ok(!src.includes(bad), `L09B must not encode blame as ${bad}`);
  }
});

test("the three quantities are computed independently, never by subtraction", () => {
  const out = allocate({ assessment: assess(), eligibleCosts: twoRoleCosts });
  const sum = out.protectedProviderPayable.minutes
    + out.customerRealityAdjustment.minutes
    + out.doneeoAbsorption.minutes;
  // They are three answers to three questions, not three slices of one number.
  // Here the customer bears the disruption AND the provider is protected for
  // the same underlying work, so the sum deliberately exceeds any single total.
  assert.ok(sum >= out.customerRealityAdjustment.minutes);
  const ppp = protectedProviderPayable({ assessment: assess(), eligibleCosts: twoRoleCosts });
  assert.equal(ppp.minutes, 330);
  assert.equal(out.customerRealityAdjustment.minutes, 330);
  assert.notEqual(ppp.minutes + out.customerRealityAdjustment.minutes, 330,
    "customer liability is not the residue of provider protection");
});

test("a hidden condition alone never creates customer liability", () => {
  assert.throws(
    () => assess({ cause: "HIDDEN_CONDITION" }),
    (e: unknown) => e instanceof FairnessInvariantError && e.invariant === "HIDDEN_CONDITION_NOT_CUSTOMER_FAULT",
  );
  // With the test not established, a hidden condition is simply absorbed.
  const a = assess({ cause: "HIDDEN_CONDITION", customerTest: noCustomerFault });
  const out = allocate({ assessment: a, eligibleCosts: twoRoleCosts });
  assert.equal(out.customerRealityAdjustment.minutes, 0);
  assert.equal(out.doneeoAbsorption.minutes, 330);
});

test("if Doneeo should have asked and did not, customer responsibility is not presumed", () => {
  const r = customerResponsibilityEstablished({
    ...customerAtFault, doneeoShouldHaveAsked: true, doneeoAskedOrDisclosedImportance: false,
  });
  assert.equal(r.established, false);
  assert.match(r.because, /should reasonably have asked/);
});

test("ignoring contradictory evidence defeats the customer test outright", () => {
  const r = customerResponsibilityEstablished({ ...customerAtFault, doneeoIgnoredContradictoryEvidence: true });
  assert.equal(r.established, false);
  assert.match(r.because, /contradictory evidence/);
});

test("every leg of the customer test is required", () => {
  const legs: (keyof CustomerFactTest)[] = [
    "materialFact", "doneeoAskedOrDisclosedImportance", "customerCouldReasonablyKnow",
    "inaccurateOrOmitted", "causalLink",
  ];
  for (const leg of legs) {
    const r = customerResponsibilityEstablished({ ...customerAtFault, [leg]: false });
    assert.equal(r.established, false, `${leg} must be necessary`);
    assert.ok(r.because.length > 0);
  }
  assert.equal(customerResponsibilityEstablished(customerAtFault).established, true);
});

test("insufficient evidence never defaults to customer fault", () => {
  assert.throws(
    () => assess({ evidenceRefs: [] }),
    (e: unknown) => e instanceof FairnessInvariantError && e.invariant === "EVIDENCE_REQUIRED",
  );
});

test("mixed and undetermined causes are never settled automatically", () => {
  for (const cause of ["MIXED", "UNDETERMINED"] as Cause[]) {
    const a = assess({ cause, customerTest: noCustomerFault });
    assert.equal(a.requiresReview, true);
    assert.throws(
      () => allocate({ assessment: a, eligibleCosts: twoRoleCosts }),
      (e: unknown) => e instanceof FairnessInvariantError && e.invariant === "REVIEW_REQUIRED",
      `${cause} must go to review, not to an automatic instruction`,
    );
  }
});

test("a disputed case goes to review", () => {
  const a = assess({ disputed: true });
  assert.equal(a.requiresReview, true);
  assert.match(a.reviewReason ?? "", /disputed/);
});

test("provider protection follows performance, not cause", () => {
  // Customer at fault, provider performed: still protected.
  assert.equal(providerProtectionEligible(providerPerformed).established, true);
  // Provider did not perform: not protected, and not charged to the customer.
  const a = assess({ providerTest: { ...providerPerformed, executedAsAgreed: false } });
  const out = allocate({ assessment: a, eligibleCosts: twoRoleCosts });
  assert.equal(out.protectedProviderPayable.minutes, 0);
  assert.equal(out.customerRealityAdjustment.minutes, 0,
    "a provider's own failure is never billed to the customer");
  assert.equal(out.doneeoAbsorption.minutes, 330);
});

test("provider protection on the instruction is not structurally always zero", () => {
  // It was. PROVIDER_PROTECTED was a member of Bearer that bearerFor() never
  // returned, so summing allocations by it gave 0 for every case that has ever
  // existed. The unit tests missed it because they asserted the standalone
  // protectedProviderPayable() instead, and it only surfaced when a live run
  // paid a provider nothing for a job they had performed correctly.
  const out = allocate({ assessment: assess(), eligibleCosts: twoRoleCosts });
  assert.ok(out.protectedProviderPayable.minutes > 0,
    "a performing provider must be protected on the instruction, not only via the helper");
  assert.deepEqual(out.protectedProviderPayable.byRole, { lead: 45, helper: 285 });

  // And it must agree with the independent calculation, since they answer the
  // same question over the same costs.
  const standalone = protectedProviderPayable({ assessment: assess(), eligibleCosts: twoRoleCosts });
  assert.deepEqual(out.protectedProviderPayable.byRole, standalone.byRole);
  assert.equal(out.protectedProviderPayable.minutes, standalone.minutes);
});

test("a provider who did not perform is protected for nothing", () => {
  const a = assess({ providerTest: { ...providerPerformed, executedAsAgreed: false } });
  const out = allocate({ assessment: a, eligibleCosts: twoRoleCosts });
  assert.equal(out.protectedProviderPayable.minutes, 0, "protection follows performance");
  assert.equal(out.customerRealityAdjustment.minutes, 0, "and is never billed onward");
});

test("every allocation records why", () => {
  const out = allocate({ assessment: assess(), eligibleCosts: twoRoleCosts });
  assert.equal(out.allocations.length, twoRoleCosts.length);
  for (const a of out.allocations) {
    assert.ok(a.because.trim().length > 10, "an allocation without a reason is not auditable");
    // A provider is not a bearer: bearing is who pays, and a performing
    // provider is owed, not charged.
    assert.ok(["CUSTOMER", "DONEEO_ABSORBED"].includes(a.bearer));
  }
});

test("recovery credit is Doneeo-funded and separate from absorption of its own error", () => {
  const out = allocate({
    assessment: assess(),
    eligibleCosts: twoRoleCosts,
    recoveryCredit: [{ kind: "ACTUAL_WORK", role: "lead", minutes: 30 }],
  });
  assert.equal(out.recoveryCredit.minutes, 30);
  assert.notEqual(out.recoveryCredit.minutes, out.doneeoAbsorption.minutes,
    "goodwill and error-absorption are different quantities");
});

test("doneeo responsibility is established by control, not by elimination", () => {
  assert.equal(doneeoResponsible(doneeoClean).established, false);
  assert.equal(doneeoResponsible({ ...doneeoClean, planningError: true }).established, true);
  assert.equal(doneeoResponsible({ ...doneeoClean, partnerFailureUnderDoneeoContract: true }).established, true);
});
