/**
 * L09B — Responsibility & Fairness Economic.
 *
 * Decides who bears which consequence when reality broke the plan. L09A already
 * decided what to do about it; L6 prices revised work; L12 posts the ledger.
 * This layer allocates, and does nothing else.
 *
 * WHY THERE IS NO SCORE ANYWHERE IN THIS FILE
 *
 * Every superseded 09B variant carried contribution percentages or a weighted
 * blame engine, and the reconciliation struck all of them: "NO weighted blame
 * engine. Responsibility = evidence + causality + policy."
 *
 * That is not squeamishness about numbers. A weight implies the parties'
 * shares are commensurable and sum to a whole, and they are not. Provider
 * Protected Payable, Customer Reality Adjustment and Doneeo Absorption are
 * three independent quantities that answer three different questions:
 *
 *   PPP  what did the provider legitimately earn or lose?
 *   CRA  what may the customer fairly be asked to bear?
 *   DA   what does the platform carry itself?
 *
 * They are not three slices of one pie. A case can protect a provider fully,
 * charge the customer nothing, and be absorbed entirely by Doneeo — that is not
 * an arithmetic error, it is a planning error correctly handled. A test asserts
 * no total is ever derived from the others by subtraction.
 */

/** The canonical cause taxonomy, verbatim from the L09B board panel. */
export type Cause =
  | "HIDDEN_CONDITION"
  | "CUSTOMER_INACCURATE_OR_OMITTED_FACT"
  | "CUSTOMER_SCOPE_CHANGE"
  | "DONEEO_PLANNING_ERROR"
  | "PROVIDER_PREP_OR_EXECUTION_FAILURE"
  | "RESOURCE_OR_PARTNER_FAILURE"
  | "EXTERNAL"
  | "SAFETY_OR_REGULATORY"
  | "MIXED"
  | "UNDETERMINED";

export class FairnessInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "FairnessInvariantError";
  }
}

/**
 * The customer material-fact test.
 *
 * Every condition must hold, and either defeater sinks it. The defeaters are
 * the part that matters and the part a naive implementation omits: canon says
 * "if Doneeo reasonably should have asked but did not, customer responsibility
 * is not presumed", and separately that Doneeo ignoring contradictory evidence
 * defeats the test too.
 *
 * A customer cannot be held responsible for failing to volunteer something we
 * never asked about and could have.
 */
export type CustomerFactTest = {
  /** Would the answer have changed the plan? */
  readonly materialFact: boolean;
  /** Did we ask, or disclose that it mattered? */
  readonly doneeoAskedOrDisclosedImportance: boolean;
  /** Could this customer reasonably have known it? */
  readonly customerCouldReasonablyKnow: boolean;
  /** Was what they told us wrong, or left out? */
  readonly inaccurateOrOmitted: boolean;
  /** Did that actually cause the disruption? */
  readonly causalLink: boolean;
  /** Defeater: we should have asked and did not. */
  readonly doneeoShouldHaveAsked: boolean;
  /** Defeater: we were told something contradictory and proceeded anyway. */
  readonly doneeoIgnoredContradictoryEvidence: boolean;
};

export type TestOutcome = {
  readonly established: boolean;
  /** Which condition or defeater decided it. Never empty. */
  readonly because: string;
};

export function customerResponsibilityEstablished(t: CustomerFactTest): TestOutcome {
  if (t.doneeoIgnoredContradictoryEvidence) {
    return { established: false, because: "Doneeo proceeded despite contradictory evidence" };
  }
  if (t.doneeoShouldHaveAsked && !t.doneeoAskedOrDisclosedImportance) {
    return { established: false, because: "Doneeo should reasonably have asked and did not" };
  }
  if (!t.materialFact) return { established: false, because: "the fact was not material to the plan" };
  if (!t.doneeoAskedOrDisclosedImportance) {
    return { established: false, because: "Doneeo never asked or disclosed that it mattered" };
  }
  if (!t.customerCouldReasonablyKnow) {
    return { established: false, because: "the customer could not reasonably have known" };
  }
  if (!t.inaccurateOrOmitted) return { established: false, because: "what the customer stated was accurate" };
  if (!t.causalLink) return { established: false, because: "no causal link to the disruption" };
  return { established: true, because: "material fact, asked, knowable, inaccurate, and causal" };
}

/** Provider protection turns on obligation and performance, not on cause. */
export type ProviderPerformanceTest = {
  readonly metObligations: boolean;
  readonly preparedAsAgreed: boolean;
  readonly executedAsAgreed: boolean;
  readonly evidenceRefs: readonly string[];
};

export function providerProtectionEligible(t: ProviderPerformanceTest): TestOutcome {
  if (!t.metObligations) return { established: false, because: "provider did not meet its obligations" };
  if (!t.preparedAsAgreed) return { established: false, because: "provider did not prepare as agreed" };
  if (!t.executedAsAgreed) return { established: false, because: "provider did not execute as agreed" };
  return { established: true, because: "provider met obligations, prepared and executed as agreed" };
}

/** Doneeo responsibility follows from what the platform controlled. */
export type DoneeoControlTest = {
  readonly planningError: boolean;
  readonly systemOrMarketplaceFailure: boolean;
  readonly partnerFailureUnderDoneeoContract: boolean;
};

export function doneeoResponsible(t: DoneeoControlTest): TestOutcome {
  if (t.planningError) return { established: true, because: "Doneeo planning error" };
  if (t.systemOrMarketplaceFailure) return { established: true, because: "Doneeo system or marketplace failure" };
  if (t.partnerFailureUnderDoneeoContract) {
    return { established: true, because: "partner failure under a Doneeo contract" };
  }
  return { established: false, because: "nothing within Doneeo's control caused this" };
}

/**
 * The assessment. Three independent findings — deliberately not a distribution.
 *
 * Note that all three can be true, or all three false. There is no
 * normalisation step and there must never be one.
 */
export type ResponsibilityAssessment = {
  readonly realityCaseId: string;
  readonly cause: Cause;
  readonly customer: TestOutcome;
  readonly provider: TestOutcome;
  readonly doneeo: TestOutcome;
  /** Routed to a human or to L13 rather than settled deterministically. */
  readonly requiresReview: boolean;
  readonly reviewReason: string | null;
  readonly evidenceRefs: readonly string[];
};

export type ReviewPolicy = {
  /** High value, disputed, or anything the policy declines to settle alone. */
  requiresReview(input: {
    readonly cause: Cause;
    readonly disputed: boolean;
    readonly customerEstablished: boolean;
    readonly doneeoEstablished: boolean;
  }): { readonly required: boolean; readonly reason: string | null };
};

export function assessResponsibility(input: {
  realityCaseId: string;
  cause: Cause;
  customerTest: CustomerFactTest;
  providerTest: ProviderPerformanceTest;
  doneeoTest: DoneeoControlTest;
  disputed: boolean;
  evidenceRefs: readonly string[];
  policy: ReviewPolicy;
}): ResponsibilityAssessment {
  const customer = customerResponsibilityEstablished(input.customerTest);
  const provider = providerProtectionEligible(input.providerTest);
  const doneeo = doneeoResponsible(input.doneeoTest);

  // A hidden condition is, by definition, something nobody knew. Canon states
  // it outright: "hidden condition alone does not create customer liability."
  if (input.cause === "HIDDEN_CONDITION" && customer.established) {
    throw new FairnessInvariantError(
      "HIDDEN_CONDITION_NOT_CUSTOMER_FAULT",
      "a hidden condition cannot establish customer responsibility on its own",
    );
  }

  // Mixed and undetermined are not settled by inference.
  const forced = input.cause === "MIXED" || input.cause === "UNDETERMINED";
  const fromPolicy = input.policy.requiresReview({
    cause: input.cause,
    disputed: input.disputed,
    customerEstablished: customer.established,
    doneeoEstablished: doneeo.established,
  });
  const requiresReview = forced || input.disputed || fromPolicy.required;
  const reviewReason = forced
    ? `cause is ${input.cause} and cannot be settled by inference`
    : input.disputed ? "the case is disputed" : fromPolicy.reason;

  if (input.evidenceRefs.length === 0 && customer.established) {
    throw new FairnessInvariantError(
      "EVIDENCE_REQUIRED",
      "customer responsibility requires evidence; insufficient evidence never defaults to customer fault",
    );
  }

  return Object.freeze({
    realityCaseId: input.realityCaseId,
    cause: input.cause,
    customer, provider, doneeo,
    requiresReview,
    reviewReason: requiresReview ? (reviewReason ?? "policy review") : null,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
  });
}
