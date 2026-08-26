/**
 * L6 — CommercialOffer & Pricing. Cost composition and price.
 *
 * THIS IS THE FIRST LAYER ALLOWED TO HAVE MONEY.
 *
 * L7 measures capacity in minutes. L09A classifies. L09B allocates minutes to
 * parties. None of them may express an amount, and tests enforce it. L6 is
 * where quantities become a price, and L12 is where a price becomes a ledger
 * entry. That makes this module the boundary, so two things are strict here:
 *
 *   Money is an integer count of minor units — cents, never dollars, never a
 *   float. 0.1 + 0.2 is not 0.3, and a rounding drift in a price is a customer
 *   complaint that cannot be reproduced.
 *
 *   A price is never invented. Canon's failure path is "missing cost input ->
 *   conservative range or block offer". There is deliberately no code path here
 *   that produces a number from an absent input.
 *
 * NO THRESHOLD IS HARDCODED, same as L7. Margin, floors, caps and rounding
 * rules arrive through PricingPolicy. A Montréal pilot and a later region are
 * different policy objects; neither is canon.
 */

export class PricingInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "PricingInvariantError";
  }
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** ISO 4217. Kept narrow deliberately — a new market is a decision, not a typo. */
export type Currency = "CAD";

/**
 * An amount in minor units.
 *
 * `minorUnits: 12550` in CAD is $125.50. There is no constructor that accepts
 * a decimal, because every rounding bug in a billing system starts with one.
 */
export type Money = {
  readonly minorUnits: number;
  readonly currency: Currency;
};

export function money(minorUnits: number, currency: Currency = "CAD"): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new PricingInvariantError(
      "NON_INTEGER_MONEY",
      `money must be whole minor units; got ${minorUnits}. Round explicitly with a policy rule, never implicitly.`,
    );
  }
  if (minorUnits < 0) {
    throw new PricingInvariantError("NEGATIVE_MONEY", "a price component cannot be negative; use a discount component");
  }
  return Object.freeze({ minorUnits, currency });
}

export const ZERO: Money = Object.freeze({ minorUnits: 0, currency: "CAD" as const });

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new PricingInvariantError("CURRENCY_MISMATCH", `cannot add ${a.currency} to ${b.currency}`);
  }
  return money(a.minorUnits + b.minorUnits, a.currency);
}

export function sumMoney(all: readonly Money[], currency: Currency = "CAD"): Money {
  return all.reduce(addMoney, money(0, currency));
}

// ---------------------------------------------------------------------------
// Cost inputs
// ---------------------------------------------------------------------------

/**
 * What a cost component covers.
 *
 * DIRECT is work and resources traceable to this job. INDIRECT is overhead
 * apportioned by policy. They are kept apart because canon forbids exposing
 * provider private cost detail beyond policy, and the split is what lets a
 * breakdown be shown to a customer without leaking a provider's rates.
 */
export type CostKind = "LABOUR" | "RESOURCE" | "RENTAL" | "TRAVEL" | "MATERIALS" | "INDIRECT";

export type CostComponent = {
  readonly kind: CostKind;
  readonly label: string;
  readonly amount: Money;
  /** Where this number came from. A component with no source cannot be audited. */
  readonly sourceRef: string;
  /**
   * When the underlying quote stops being usable, if it has an expiry.
   *
   * Rental quotes do. Canon's G1 is precisely this: an expired rental quote
   * must force an offer refresh rather than silently pricing at a stale rate.
   */
  readonly validUntil?: string;
  /** True when the figure is a policy-bounded range rather than a firm quote. */
  readonly provisional?: boolean;
};

/**
 * A cost input that is missing rather than zero.
 *
 * The distinction matters more than it looks: a job with no rental cost and a
 * job whose rental cost is unknown price identically if you treat both as zero,
 * and only one of them is safe to quote.
 */
export type MissingCost = {
  readonly kind: CostKind;
  readonly why: string;
};

export type FulfillmentCostSnapshot = {
  readonly fulfillmentOptionRef: string;
  readonly components: readonly CostComponent[];
  readonly missing: readonly MissingCost[];
  readonly takenAt: string;
};

// ---------------------------------------------------------------------------
// Policy port
// ---------------------------------------------------------------------------

export type PriceBand = "BUDGET" | "RECOMMENDED" | "FULL_SERVICE";

export type PricingPolicy = {
  /** Margin applied to composed cost, as a policy decision, not a constant. */
  applyMargin(input: { cost: Money; band: PriceBand; riskProfile: string }): Money;
  /** Policy floor and cap. Returning a violation blocks the offer. */
  checkFloorAndCap(input: { price: Money; cost: Money; band: PriceBand }):
    { readonly ok: true } | { readonly ok: false; readonly reason: string };
  /** Rounding is a commercial decision — never an implicit Math.round. */
  round(price: Money): Money;
  /** Whether a human must approve before this offer may be shown. */
  requiresHumanReview(input: {
    readonly price: Money;
    readonly cost: Money;
    readonly provisionalComponents: number;
    readonly jurisdiction: string;
  }): { readonly required: boolean; readonly reason: string | null };
};

/**
 * Tax is determined elsewhere and referenced, never computed here.
 *
 * Canon lists a "Tax Determination Interface" under Owns and "Tax uncertainty
 * -> manual review / external authority" under failure. Computing a rate inline
 * would make Doneeo the tax authority for every jurisdiction it enters.
 */
export type TaxDetermination = {
  determine(input: { taxableBase: Money; jurisdiction: string; at: string }):
    | { readonly resolved: true; readonly taxDecisionRef: string; readonly taxes: readonly TaxLine[] }
    | { readonly resolved: false; readonly reason: string };
};

export type TaxLine = {
  readonly label: string;
  readonly amount: Money;
  readonly rateRef: string;
};

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export type PriceBreakdown = {
  readonly band: PriceBand;
  /** Shown to the customer. Indirect cost is folded, never itemised per canon. */
  readonly lines: readonly { label: string; amount: Money }[];
  readonly directCost: Money;
  readonly indirectCost: Money;
  readonly subtotal: Money;
  readonly taxes: readonly TaxLine[];
  readonly taxDecisionRef: string;
  readonly total: Money;
  /** Stated assumptions. Canon: an offer rests on known facts AND assumptions. */
  readonly assumptions: readonly string[];
};

/**
 * Compose cost, apply policy, attach tax.
 *
 * Throws rather than returning a number when an input is missing or a quote has
 * expired. A caller that wants a quotable range asks the policy for one; it
 * does not get one by accident from this function.
 */
export function composePrice(input: {
  snapshot: FulfillmentCostSnapshot;
  band: PriceBand;
  riskProfile: string;
  jurisdiction: string;
  policy: PricingPolicy;
  tax: TaxDetermination;
  now: string;
}): PriceBreakdown {
  const { snapshot, band, policy, tax, now } = input;

  if (snapshot.missing.length > 0) {
    throw new PricingInvariantError(
      "MISSING_COST_INPUT",
      `cannot price with unknown ${snapshot.missing.map(m => m.kind).join(", ")}: ` +
      snapshot.missing.map(m => m.why).join("; ") +
      ". A missing cost is not a zero cost.",
    );
  }
  if (snapshot.components.length === 0) {
    throw new PricingInvariantError("NO_COST_COMPONENTS", "an offer with no cost basis is not an offer");
  }

  // G1: a component whose quote has expired cannot be priced from. The offer
  // must be refreshed against a current snapshot instead.
  const expired = snapshot.components.filter(c => c.validUntil !== undefined && c.validUntil < now);
  if (expired.length > 0) {
    throw new PricingInvariantError(
      "EXPIRED_COST_QUOTE",
      `quote expired for ${expired.map(c => c.label).join(", ")}; reprice from a current fulfillment snapshot`,
    );
  }

  const direct = sumMoney(snapshot.components.filter(c => c.kind !== "INDIRECT").map(c => c.amount));
  const indirect = sumMoney(snapshot.components.filter(c => c.kind === "INDIRECT").map(c => c.amount));
  const cost = addMoney(direct, indirect);

  const withMargin = policy.applyMargin({ cost, band, riskProfile: input.riskProfile });
  const subtotal = policy.round(withMargin);

  const bounds = policy.checkFloorAndCap({ price: subtotal, cost, band });
  if (!bounds.ok) {
    throw new PricingInvariantError("FLOOR_OR_CAP", `pricing policy rejected this offer: ${bounds.reason}`);
  }

  const determined = tax.determine({ taxableBase: subtotal, jurisdiction: input.jurisdiction, at: now });
  if (!determined.resolved) {
    throw new PricingInvariantError(
      "TAX_UNRESOLVED",
      `tax could not be determined (${determined.reason}); route to review rather than quoting a total`,
    );
  }

  const total = addMoney(subtotal, sumMoney(determined.taxes.map(t => t.amount)));

  // Provider private cost detail is not itemised. The customer sees what the
  // work is, not what the provider is paid for it.
  const lines = snapshot.components
    .filter(c => c.kind !== "INDIRECT")
    .map(c => ({ label: c.label, amount: c.amount }));

  const assumptions = snapshot.components
    .filter(c => c.provisional)
    .map(c => `${c.label} is a policy-bounded estimate, not a firm quote (${c.sourceRef})`);

  return Object.freeze({
    band,
    lines: Object.freeze(lines),
    directCost: direct,
    indirectCost: indirect,
    subtotal,
    taxes: Object.freeze(determined.taxes),
    taxDecisionRef: determined.taxDecisionRef,
    total,
    assumptions: Object.freeze(assumptions),
  });
}
