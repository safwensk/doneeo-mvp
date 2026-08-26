/**
 * L6 — the CommercialOffer and the ScopeContract.
 *
 * THE INVARIANT THIS MODULE EXISTS TO PROTECT
 *
 * "Offer price is not final settlement after reality changes."
 *
 * That sentence is the seam between L6 and everything downstream. An offer says
 * what the job was expected to cost given what was known. What the customer
 * finally owes is decided by L09B allocating real consequences and L12 posting
 * them. Those are different numbers arrived at by different means, and a system
 * that lets one be mistaken for the other will bill people for work nobody did.
 *
 * So the type carries `isFinalSettlement: false` as a literal — the same device
 * L09B uses for `chargesUnperformedWork`. It is not a flag anyone sets; it is a
 * shape that cannot express the wrong thing.
 *
 * TWO MORE THINGS ARE STRUCTURAL
 *
 * An offer is bound to the exact RequirementContract and fulfillment versions
 * it was priced from. Canon gates on "price corresponds to same RC/fulfillment
 * versions?" — because a plan that has moved on invalidates the price silently
 * otherwise.
 *
 * Options must differ by real configuration. A "budget" option that is the same
 * work at a lower margin is not a choice, it is a discount wearing a costume,
 * and canon's G2 asks for options that "differ in real feasible configuration".
 */

import {
  type Money, type PriceBreakdown, type PriceBand, PricingInvariantError,
} from "./pricing";

// ---------------------------------------------------------------------------
// Scope contract
// ---------------------------------------------------------------------------

/**
 * What the customer is commercially owed, frozen.
 *
 * Distinct from L2's RequirementContract, which says what successful work
 * MEANS. This says what was agreed to be delivered for a price. L2's is
 * provider-neutral; this one is not, because it is priced against a specific
 * fulfillment configuration.
 */
export type ScopeContract = {
  readonly scopeContractId: string;
  readonly requirementContractRef: string;
  readonly fulfillmentOptionRef: string;
  readonly inclusions: readonly string[];
  /** Named exclusions. An unstated exclusion is a dispute waiting to happen. */
  readonly exclusions: readonly string[];
  readonly assumptions: readonly string[];
  /**
   * Variance the customer has pre-authorised, so trivial reality does not need
   * a fresh approval. Canon calls this an Allowance. It is a ceiling, never a
   * licence to expand scope — L10's invariant is "execution never self-expands
   * scope", and this does not soften it.
   */
  readonly allowance: Allowance;
  readonly createdAt: string;
};

export type Allowance = {
  readonly maxVariance: Money;
  readonly appliesTo: readonly string[];
  readonly requiresApprovalBeyond: true;
};

// ---------------------------------------------------------------------------
// Payment topology
// ---------------------------------------------------------------------------

/**
 * Who pays whom, and when.
 *
 * Selected from the contract role profile, not from the price — canon's G3.
 * A business customer with net terms and a household customer paying on
 * completion are different topologies for the same work at the same price.
 */
export type PaymentTopology =
  | "CUSTOMER_PREPAY"
  | "CUSTOMER_ON_COMPLETION"
  | "SPLIT_DEPOSIT_BALANCE"
  | "INVOICED_NET_TERMS"
  | "THIRD_PARTY_PAYER";

export type RoleProfile = {
  readonly payerType: "HOUSEHOLD" | "BUSINESS" | "INSTITUTIONAL" | "THIRD_PARTY";
  readonly hasApprovedCredit: boolean;
  readonly isRecurringCustomer: boolean;
};

export type PaymentTopologyPolicy = {
  select(input: { profile: RoleProfile; band: PriceBand }): PaymentTopology;
};

// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

export type OfferOption = {
  readonly band: PriceBand;
  /** The configuration this option actually buys. Two options may not share one. */
  readonly fulfillmentOptionRef: string;
  readonly breakdown: PriceBreakdown;
  /** Plain-language difference from the other options. Never a price adjective. */
  readonly differsBy: string;
};

export type CommercialOffer = {
  readonly offerId: string;
  readonly requirementContractRef: string;
  /** Version the price was computed against. Moves, and the offer is void. */
  readonly requirementContractVersion: number;
  readonly options: readonly OfferOption[];
  readonly scopeContract: ScopeContract;
  readonly paymentTopology: PaymentTopology;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly requiresHumanReview: boolean;
  readonly reviewReason: string | null;
  /**
   * Always false. See the module header: an offer is what the job was expected
   * to cost, never what the customer finally owes.
   */
  readonly isFinalSettlement: false;
};

export function createOffer(input: {
  offerId: string;
  requirementContractRef: string;
  requirementContractVersion: number;
  options: readonly OfferOption[];
  scopeContract: ScopeContract;
  profile: RoleProfile;
  topologyPolicy: PaymentTopologyPolicy;
  validFrom: string;
  validUntil: string;
  review?: { required: boolean; reason: string | null };
}): CommercialOffer {
  if (input.options.length === 0) {
    throw new PricingInvariantError("NO_OPTIONS", "an offer must present at least one feasible option");
  }

  // G2: options must be genuinely different work, not one configuration at
  // several margins. Two bands sharing a fulfillment ref is a fake choice.
  const configs = new Map<string, PriceBand>();
  for (const o of input.options) {
    const clash = configs.get(o.fulfillmentOptionRef);
    if (clash) {
      throw new PricingInvariantError(
        "OPTIONS_NOT_DISTINCT",
        `${clash} and ${o.band} price the same configuration (${o.fulfillmentOptionRef}); ` +
        "options must differ in real feasible configuration, not in margin",
      );
    }
    configs.set(o.fulfillmentOptionRef, o.band);
  }

  for (const o of input.options) {
    if (!o.differsBy.trim()) {
      throw new PricingInvariantError(
        "UNEXPLAINED_OPTION",
        `option ${o.band} does not say how it differs; a customer cannot choose between unexplained prices`,
      );
    }
  }

  // The scope contract must describe the configuration one of the options
  // actually buys, or the customer is agreeing to something unpriced.
  if (!configs.has(input.scopeContract.fulfillmentOptionRef)) {
    throw new PricingInvariantError(
      "SCOPE_CONTRACT_MISMATCH",
      "the scope contract names a configuration that no option prices",
    );
  }
  if (input.scopeContract.requirementContractRef !== input.requirementContractRef) {
    throw new PricingInvariantError(
      "REQUIREMENT_MISMATCH",
      "the scope contract and the offer name different RequirementContracts",
    );
  }
  if (input.validUntil <= input.validFrom) {
    throw new PricingInvariantError("INVALID_VALIDITY", "an offer must be valid for a non-empty window");
  }

  const topology = input.topologyPolicy.select({
    profile: input.profile,
    band: input.options[0]!.band,
  });

  return Object.freeze({
    offerId: input.offerId,
    requirementContractRef: input.requirementContractRef,
    requirementContractVersion: input.requirementContractVersion,
    options: Object.freeze([...input.options]),
    scopeContract: input.scopeContract,
    paymentTopology: topology,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    requiresHumanReview: input.review?.required ?? false,
    reviewReason: input.review?.required ? (input.review.reason ?? "policy review") : null,
    isFinalSettlement: false,
  });
}

export type SelectedOffer = {
  readonly offerId: string;
  readonly band: PriceBand;
  readonly fulfillmentOptionRef: string;
  readonly total: Money;
  readonly scopeContract: ScopeContract;
  readonly paymentTopology: PaymentTopology;
  readonly selectedAt: string;
  /** Still false. Selection commits to a price, not to a settlement. */
  readonly isFinalSettlement: false;
};

/**
 * Take an option, and hand the result to L7.
 *
 * The three gates canon lists are enforced here rather than trusted: still
 * within validity, priced against the current RequirementContract version, and
 * not awaiting a human. None of them can be waived by the caller.
 */
export function selectOption(input: {
  offer: CommercialOffer;
  band: PriceBand;
  /** The RC version as it stands NOW, which may have moved since pricing. */
  currentRequirementContractVersion: number;
  now: string;
}): SelectedOffer {
  const { offer, now } = input;

  if (now < offer.validFrom || now > offer.validUntil) {
    throw new PricingInvariantError(
      "OFFER_EXPIRED",
      `offer ${offer.offerId} was valid ${offer.validFrom} to ${offer.validUntil}; reprice from a current snapshot`,
    );
  }
  if (input.currentRequirementContractVersion !== offer.requirementContractVersion) {
    throw new PricingInvariantError(
      "REQUIREMENT_VERSION_MOVED",
      `offer priced against RequirementContract v${offer.requirementContractVersion}, ` +
      `now v${input.currentRequirementContractVersion}; the plan changed and the price no longer describes it`,
    );
  }
  if (offer.requiresHumanReview) {
    throw new PricingInvariantError(
      "AWAITING_REVIEW",
      `offer ${offer.offerId} is awaiting review (${offer.reviewReason}) and may not be selected`,
    );
  }

  const option = offer.options.find(o => o.band === input.band);
  if (!option) {
    throw new PricingInvariantError("NO_SUCH_OPTION", `offer ${offer.offerId} has no ${input.band} option`);
  }
  if (option.fulfillmentOptionRef !== offer.scopeContract.fulfillmentOptionRef) {
    throw new PricingInvariantError(
      "SCOPE_CONTRACT_MISMATCH",
      `the ${input.band} option buys a different configuration than the scope contract describes`,
    );
  }

  return Object.freeze({
    offerId: offer.offerId,
    band: option.band,
    fulfillmentOptionRef: option.fulfillmentOptionRef,
    total: option.breakdown.total,
    scopeContract: offer.scopeContract,
    paymentTopology: offer.paymentTopology,
    selectedAt: now,
    isFinalSettlement: false,
  });
}

/** Whether an offer may still be shown. Expiry is a fact, not a policy call. */
export function isExpired(offer: CommercialOffer, now: string): boolean {
  return now > offer.validUntil;
}
