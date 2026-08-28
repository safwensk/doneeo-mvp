/**
 * L09B — allocating the consequence.
 *
 * Takes the eligible cost components L7 measured and assigns each to whoever
 * bears it. It does not price them: canon is explicit that "L6 owns price;
 * 09B allocates economic responsibility, it does not price", and L12 posts the
 * ledger. Everything here is minutes and references, same as L7.
 *
 * THE THREE TOTALS ARE COMPUTED INDEPENDENTLY
 *
 * Each component is assigned exactly one bearer, and each total is the sum of
 * its own components. No total is ever `whole − others`. That is what keeps
 * Provider Protected Payable, Customer Reality Adjustment and Doneeo Absorption
 * three separate answers rather than three shares of one number, and it is why
 * a case can protect the provider in full while charging the customer nothing.
 */

import type { EligibleCost } from "../l7/cancellation";
import {
  type ResponsibilityAssessment, FairnessInvariantError,
} from "./responsibility";

/**
 * Who CARRIES a component. Exactly one per component — never a split weight.
 *
 * A provider is deliberately not a bearer. Bearing is about who pays a cost,
 * and a performing provider never pays — they are owed. Protection is a
 * separate axis, computed by protectedProviderPayable() from performance
 * rather than from fault.
 *
 * This union used to include PROVIDER_PROTECTED, and the result was a field on
 * AdjustmentInstruction that no code path could ever make non-zero: bearerFor()
 * never returned it, so summing allocations by it always gave 0. Nothing caught
 * that until a provider who had done everything right was paid nothing in a
 * live run.
 */
export type Bearer = "CUSTOMER" | "DONEEO_ABSORBED";

export type AllocatedComponent = {
  readonly component: EligibleCost;
  readonly bearer: Bearer;
  /** Why this bearer. Feeds DecisionTrace; a bare allocation is not auditable. */
  readonly because: string;
};

/**
 * Independent totals, by role where the underlying component had one.
 *
 * `minutes` is a quantity, not an amount. L12 applies rates.
 */
export type PartyTotal = {
  readonly minutes: number;
  readonly externalCostRefs: readonly string[];
  readonly byRole: Readonly<Record<string, number>>;
};

export type AdjustmentInstruction = {
  readonly realityCaseId: string;
  readonly cause: ResponsibilityAssessment["cause"];
  readonly allocations: readonly AllocatedComponent[];
  /** Per assigned role or person, as canon requires — never a job-level lump. */
  readonly protectedProviderPayable: PartyTotal;
  readonly customerRealityAdjustment: PartyTotal;
  readonly doneeoAbsorption: PartyTotal;
  /** Doneeo-funded goodwill, distinct from absorption of its own error. */
  readonly recoveryCredit: PartyTotal;
  readonly requiresReview: boolean;
  /**
   * Always false. The invariant is load-bearing and worth being unable to
   * express: "customer never automatically pays full original price for
   * unperformed work", and declining revised work does not owe the revised job.
   */
  readonly chargesUnperformedWork: false;
};

function emptyTotal(): PartyTotal {
  return Object.freeze({ minutes: 0, externalCostRefs: Object.freeze([]), byRole: Object.freeze({}) });
}

function total(components: readonly AllocatedComponent[], bearer: Bearer): PartyTotal {
  const mine = components.filter(c => c.bearer === bearer);
  const byRole: Record<string, number> = {};
  let minutes = 0;
  const refs: string[] = [];
  for (const { component } of mine) {
    if (component.minutes !== undefined) {
      minutes += component.minutes;
      byRole[component.role] = (byRole[component.role] ?? 0) + component.minutes;
    }
    if (component.externalCostRef) refs.push(component.externalCostRef);
  }
  return Object.freeze({ minutes, externalCostRefs: Object.freeze(refs), byRole: Object.freeze(byRole) });
}

/**
 * Assign one component.
 *
 * Reads as a series of rules rather than a formula, deliberately: canon says
 * responsibility is "evidence + causality + policy", and a formula would smuggle
 * a weighting back in.
 */
function bearerFor(
  component: EligibleCost,
  a: ResponsibilityAssessment,
): { bearer: Bearer; because: string } {
  // A provider who met its obligations is protected regardless of what caused
  // the disruption. Protection is about performance, not about fault.
  const providerEarned =
    component.kind === "PREPARATION" || component.kind === "MOBILIZATION" ||
    component.kind === "ACTUAL_WORK" || component.kind === "NET_LOST_CAPACITY";

  if (providerEarned && !a.provider.established) {
    // The provider did not perform. Nobody else carries that.
    return { bearer: "DONEEO_ABSORBED", because: "provider protection not established; not chargeable to the customer" };
  }

  // Doneeo's own error never becomes a customer surcharge, even when the
  // provider is fully protected. Canon states this as an invariant.
  if (a.doneeo.established) {
    return { bearer: "DONEEO_ABSORBED", because: `Doneeo responsible: ${a.doneeo.because}` };
  }

  if (a.customer.established) {
    return { bearer: "CUSTOMER", because: `customer responsibility established: ${a.customer.because}` };
  }

  // Nobody is responsible — a hidden condition, an external event. The platform
  // carries it rather than defaulting it onto the customer.
  return { bearer: "DONEEO_ABSORBED", because: `no party responsible (${a.cause}); platform carries it` };
}

export function allocate(input: {
  assessment: ResponsibilityAssessment;
  /** The eligible components L7 measured, after backfill. */
  eligibleCosts: readonly EligibleCost[];
  /** Doneeo-funded goodwill, decided by policy, not by fault. */
  recoveryCredit?: readonly EligibleCost[];
}): AdjustmentInstruction {
  const { assessment: a } = input;

  if (a.requiresReview) {
    // Deterministic settlement is for clear cases. Mixed, undetermined,
    // disputed and high-value go to a human or to L13 — and an instruction
    // must not quietly pre-decide what that review is for.
    throw new FairnessInvariantError(
      "REVIEW_REQUIRED",
      `this assessment requires review (${a.reviewReason}) and cannot be allocated automatically`,
    );
  }

  const allocations = input.eligibleCosts.map(component => {
    const { bearer, because } = bearerFor(component, a);
    return Object.freeze({ component, bearer, because });
  });

  const customer = total(allocations, "CUSTOMER");
  if (customer.minutes > 0 && a.evidenceRefs.length === 0) {
    throw new FairnessInvariantError(
      "EVIDENCE_REQUIRED",
      "a customer adjustment must be evidence-backed; insufficient evidence never defaults to the customer",
    );
  }

  const credit = input.recoveryCredit?.length
    ? total(input.recoveryCredit.map(component => Object.freeze({
        component, bearer: "DONEEO_ABSORBED" as const, because: "policy-defined recovery credit",
      })), "DONEEO_ABSORBED")
    : emptyTotal();

  return Object.freeze({
    realityCaseId: a.realityCaseId,
    cause: a.cause,
    allocations: Object.freeze(allocations),
    // Each computed from its own components. None derived from the others —
    // and protection specifically is NOT a bearer sum, because the provider is
    // not a bearer. It answers a different question over the same costs.
    protectedProviderPayable: protectedProviderPayable({
      assessment: a, eligibleCosts: input.eligibleCosts,
    }),
    customerRealityAdjustment: customer,
    doneeoAbsorption: total(allocations, "DONEEO_ABSORBED"),
    recoveryCredit: credit,
    requiresReview: false,
    chargesUnperformedWork: false,
  });
}

/**
 * Provider protection, calculated per assigned role or person.
 *
 * Canon lists the components explicitly: preparation + mobilization + actual
 * work or diagnosis + net lost reserved capacity after backfill + eligible
 * external costs. "After backfill" is why L7 capacity recovery must run before
 * this layer is asked anything.
 */
export function protectedProviderPayable(input: {
  assessment: ResponsibilityAssessment;
  eligibleCosts: readonly EligibleCost[];
}): PartyTotal {
  if (!input.assessment.provider.established) return emptyTotal();
  const protectedKinds = new Set(["PREPARATION", "MOBILIZATION", "ACTUAL_WORK", "NET_LOST_CAPACITY", "EXTERNAL"]);
  const byRole: Record<string, number> = {};
  const refs: string[] = [];
  let minutes = 0;
  for (const c of input.eligibleCosts) {
    if (!protectedKinds.has(c.kind)) continue;
    if (c.minutes !== undefined) {
      minutes += c.minutes;
      byRole[c.role] = (byRole[c.role] ?? 0) + c.minutes;
    }
    if (c.externalCostRef) refs.push(c.externalCostRef);
  }
  return Object.freeze({ minutes, externalCostRefs: Object.freeze(refs), byRole: Object.freeze(byRole) });
}
