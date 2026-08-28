/**
 * L6 — CommercialOffer & Pricing.
 *
 * The three golden scenarios, plus the invariants that keep this layer from
 * becoming the place where money quietly goes wrong: integer-only amounts, no
 * price invented from a missing input, and an offer that cannot be mistaken for
 * a settlement.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  money, addMoney, sumMoney, composePrice, ZERO,
  PricingInvariantError,
  type PricingPolicy, type TaxDetermination, type FulfillmentCostSnapshot,
  type CostComponent, type PriceBreakdown,
} from "../lib/layers/l6/pricing";
import {
  createOffer, selectOption, isExpired,
  type PaymentTopologyPolicy, type RoleProfile, type ScopeContract, type OfferOption,
} from "../lib/layers/l6/offer";

const NOW = "2026-09-01T10:00:00.000Z";
const LATER = "2026-09-08T10:00:00.000Z";

const policy: PricingPolicy = {
  applyMargin: ({ cost }) => money(Math.round(cost.minorUnits * 1.3)),
  checkFloorAndCap: ({ price, cost }) =>
    price.minorUnits < cost.minorUnits ? { ok: false, reason: "price below cost" } : { ok: true },
  round: p => money(Math.round(p.minorUnits / 100) * 100),
  requiresHumanReview: () => ({ required: false, reason: null }),
};

const tax: TaxDetermination = {
  determine: ({ taxableBase }) => ({
    resolved: true,
    taxDecisionRef: "TAX-QC-2026",
    taxes: [
      { label: "GST", amount: money(Math.round(taxableBase.minorUnits * 0.05)), rateRef: "GST-5" },
      { label: "QST", amount: money(Math.round(taxableBase.minorUnits * 0.09975)), rateRef: "QST-9975" },
    ],
  }),
};

const topologyPolicy: PaymentTopologyPolicy = {
  select: ({ profile }) => {
    if (profile.payerType === "THIRD_PARTY") return "THIRD_PARTY_PAYER";
    if (profile.payerType === "BUSINESS" && profile.hasApprovedCredit) return "INVOICED_NET_TERMS";
    if (profile.payerType === "INSTITUTIONAL") return "INVOICED_NET_TERMS";
    return "CUSTOMER_ON_COMPLETION";
  },
};

const HOUSEHOLD: RoleProfile = { payerType: "HOUSEHOLD", hasApprovedCredit: false, isRecurringCustomer: false };

const labour: CostComponent = { kind: "LABOUR", label: "Two movers, 4h", amount: money(24000), sourceRef: "FUL-1" };
const rental = (validUntil?: string): CostComponent =>
  ({ kind: "RENTAL", label: "Van rental", amount: money(9000), sourceRef: "RENT-1", validUntil });

function snapshot(over: Partial<FulfillmentCostSnapshot> = {}): FulfillmentCostSnapshot {
  return {
    fulfillmentOptionRef: "FUL-1",
    components: [labour, rental(LATER)],
    missing: [],
    takenAt: NOW,
    ...over,
  };
}

const compose = (s = snapshot(), band: "BUDGET" | "RECOMMENDED" | "FULL_SERVICE" = "RECOMMENDED", now = NOW) =>
  composePrice({ snapshot: s, band, riskProfile: "standard", jurisdiction: "QC", policy, tax, now });

const scope = (fulfillmentOptionRef = "FUL-1"): ScopeContract => ({
  scopeContractId: "SC-1",
  requirementContractRef: "RC-1",
  fulfillmentOptionRef,
  inclusions: ["Load, transport and unload listed items"],
  exclusions: ["Disassembly of built-in fixtures"],
  assumptions: ["Elevator available at both addresses"],
  allowance: { maxVariance: money(2500), appliesTo: ["TRAVEL"], requiresApprovalBeyond: true },
  createdAt: NOW,
});

const option = (band: OfferOption["band"], ref: string, breakdown: PriceBreakdown): OfferOption =>
  ({ band, fulfillmentOptionRef: ref, breakdown, differsBy: `${band} crew and vehicle configuration` });

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

test("money is whole minor units and nothing else", () => {
  assert.equal(money(12550).minorUnits, 12550);
  assert.throws(() => money(125.5), (e: unknown) =>
    e instanceof PricingInvariantError && e.invariant === "NON_INTEGER_MONEY");
  assert.throws(() => money(-100), (e: unknown) =>
    e instanceof PricingInvariantError && e.invariant === "NEGATIVE_MONEY");
});

test("float arithmetic cannot leak into a price", () => {
  // The canonical demonstration: 0.1 + 0.2 !== 0.3 in floating point. In minor
  // units the same sum is exact, which is the entire reason for the type.
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.equal(addMoney(money(10), money(20)).minorUnits, 30);
  assert.equal(sumMoney([money(1), money(2), money(3)]).minorUnits, 6);
  assert.equal(sumMoney([]).minorUnits, ZERO.minorUnits);
});

// ---------------------------------------------------------------------------
// Golden scenarios
// ---------------------------------------------------------------------------

test("L6-G1 · an expired rental quote forces an offer refresh", () => {
  const stale = snapshot({ components: [labour, rental("2026-08-30T00:00:00.000Z")] });
  assert.throws(() => compose(stale), (e: unknown) =>
    e instanceof PricingInvariantError && e.invariant === "EXPIRED_COST_QUOTE");

  // A current quote for the same work prices normally.
  assert.ok(compose(snapshot()).total.minorUnits > 0);
});

test("L6-G2 · budget and recommended must differ in real configuration", () => {
  const b = compose(snapshot({ fulfillmentOptionRef: "FUL-BUDGET" }), "BUDGET");
  const r = compose(snapshot(), "RECOMMENDED");

  // Same configuration at two margins is a discount wearing a costume.
  assert.throws(() => createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("BUDGET", "FUL-1", b), option("RECOMMENDED", "FUL-1", r)],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy,
    validFrom: NOW, validUntil: LATER,
  }), (e: unknown) => e instanceof PricingInvariantError && e.invariant === "OPTIONS_NOT_DISTINCT");

  // Genuinely different configurations are a real choice.
  const offer = createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("BUDGET", "FUL-BUDGET", b), option("RECOMMENDED", "FUL-1", r)],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy,
    validFrom: NOW, validUntil: LATER,
  });
  assert.equal(offer.options.length, 2);
});

test("L6-G3 · payment topology follows the role profile, not the price", () => {
  const b = compose();
  const build = (profile: RoleProfile) => createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("RECOMMENDED", "FUL-1", b)],
    scopeContract: scope(), profile, topologyPolicy, validFrom: NOW, validUntil: LATER,
  });

  assert.equal(build(HOUSEHOLD).paymentTopology, "CUSTOMER_ON_COMPLETION");
  assert.equal(build({ payerType: "BUSINESS", hasApprovedCredit: true, isRecurringCustomer: true }).paymentTopology,
    "INVOICED_NET_TERMS");
  assert.equal(build({ payerType: "THIRD_PARTY", hasApprovedCredit: false, isRecurringCustomer: false }).paymentTopology,
    "THIRD_PARTY_PAYER");

  // Same work, same price, different topology — which is the point of G3.
  assert.equal(
    build(HOUSEHOLD).options[0]!.breakdown.total.minorUnits,
    build({ payerType: "INSTITUTIONAL", hasApprovedCredit: false, isRecurringCustomer: false }).options[0]!.breakdown.total.minorUnits,
  );
});

// ---------------------------------------------------------------------------
// A price is never invented
// ---------------------------------------------------------------------------

test("a missing cost input blocks the offer instead of pricing as zero", () => {
  const incomplete = snapshot({ missing: [{ kind: "RENTAL", why: "partner quote not returned" }] });
  assert.throws(() => compose(incomplete), (e: unknown) =>
    e instanceof PricingInvariantError && e.invariant === "MISSING_COST_INPUT");
});

test("an unknown cost and an absent cost are not the same thing", () => {
  // No rental needed at all: prices fine, and lower.
  const noRental = compose(snapshot({ components: [labour] }));
  // Rental needed but unknown: refuses.
  const unknownRental = snapshot({ components: [labour], missing: [{ kind: "RENTAL", why: "unknown" }] });
  assert.ok(noRental.total.minorUnits > 0);
  assert.throws(() => compose(unknownRental), /MISSING_COST_INPUT|unknown/);
});

test("unresolved tax routes to review rather than quoting a total", () => {
  const unresolved: TaxDetermination = { determine: () => ({ resolved: false, reason: "unknown jurisdiction" }) };
  assert.throws(() => composePrice({
    snapshot: snapshot(), band: "RECOMMENDED", riskProfile: "standard",
    jurisdiction: "??", policy, tax: unresolved, now: NOW,
  }), (e: unknown) => e instanceof PricingInvariantError && e.invariant === "TAX_UNRESOLVED");
});

test("a price below cost is rejected by policy, not silently sold", () => {
  const lossMaking: PricingPolicy = { ...policy, applyMargin: ({ cost }) => money(cost.minorUnits - 1000) };
  assert.throws(() => composePrice({
    snapshot: snapshot(), band: "BUDGET", riskProfile: "standard",
    jurisdiction: "QC", policy: lossMaking, tax, now: NOW,
  }), (e: unknown) => e instanceof PricingInvariantError && e.invariant === "FLOOR_OR_CAP");
});

test("provisional components become stated assumptions", () => {
  const b = compose(snapshot({
    components: [labour, { ...rental(LATER), provisional: true }],
  }));
  assert.equal(b.assumptions.length, 1);
  assert.match(b.assumptions[0]!, /not a firm quote/);
});

test("indirect cost is folded, never itemised to the customer", () => {
  const b = compose(snapshot({
    components: [labour, { kind: "INDIRECT", label: "Overhead", amount: money(5000), sourceRef: "POL-1" }],
  }));
  assert.equal(b.indirectCost.minorUnits, 5000);
  assert.ok(!b.lines.some(l => /overhead/i.test(l.label)),
    "provider private cost detail must not appear in the customer-facing breakdown");
});

test("the total is subtotal plus taxes, exactly", () => {
  const b = compose();
  const taxTotal = sumMoney(b.taxes.map(t => t.amount));
  assert.equal(b.total.minorUnits, b.subtotal.minorUnits + taxTotal.minorUnits);
  assert.ok(b.taxDecisionRef.length > 0, "a total without a tax decision reference is not auditable");
});

// ---------------------------------------------------------------------------
// An offer is not a settlement
// ---------------------------------------------------------------------------

test("no offer or selection can claim to be a final settlement", () => {
  const offer = createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("RECOMMENDED", "FUL-1", compose())],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy, validFrom: NOW, validUntil: LATER,
  });
  assert.equal(offer.isFinalSettlement, false);
  const selected = selectOption({ offer, band: "RECOMMENDED", currentRequirementContractVersion: 3, now: NOW });
  assert.equal(selected.isFinalSettlement, false);
});

test("selecting an expired offer is refused", () => {
  const offer = createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("RECOMMENDED", "FUL-1", compose())],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy, validFrom: NOW, validUntil: LATER,
  });
  const tooLate = "2026-09-20T00:00:00.000Z";
  assert.equal(isExpired(offer, tooLate), true);
  assert.throws(() => selectOption({ offer, band: "RECOMMENDED", currentRequirementContractVersion: 3, now: tooLate }),
    (e: unknown) => e instanceof PricingInvariantError && e.invariant === "OFFER_EXPIRED");
});

test("a moved RequirementContract voids the price", () => {
  const offer = createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("RECOMMENDED", "FUL-1", compose())],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy, validFrom: NOW, validUntil: LATER,
  });
  assert.throws(() => selectOption({ offer, band: "RECOMMENDED", currentRequirementContractVersion: 4, now: NOW }),
    (e: unknown) => e instanceof PricingInvariantError && e.invariant === "REQUIREMENT_VERSION_MOVED");
});

test("an offer awaiting human review cannot be selected", () => {
  const offer = createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("RECOMMENDED", "FUL-1", compose())],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy, validFrom: NOW, validUntil: LATER,
    review: { required: true, reason: "unusual jurisdiction" },
  });
  assert.throws(() => selectOption({ offer, band: "RECOMMENDED", currentRequirementContractVersion: 3, now: NOW }),
    (e: unknown) => e instanceof PricingInvariantError && e.invariant === "AWAITING_REVIEW");
});

test("the scope contract must describe something an option actually prices", () => {
  assert.throws(() => createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [option("RECOMMENDED", "FUL-1", compose())],
    scopeContract: scope("FUL-SOMETHING-ELSE"), profile: HOUSEHOLD, topologyPolicy,
    validFrom: NOW, validUntil: LATER,
  }), (e: unknown) => e instanceof PricingInvariantError && e.invariant === "SCOPE_CONTRACT_MISMATCH");
});

test("an option that does not say how it differs is refused", () => {
  const b = compose();
  assert.throws(() => createOffer({
    offerId: "OF-1", requirementContractRef: "RC-1", requirementContractVersion: 3,
    options: [{ band: "RECOMMENDED", fulfillmentOptionRef: "FUL-1", breakdown: b, differsBy: "   " }],
    scopeContract: scope(), profile: HOUSEHOLD, topologyPolicy, validFrom: NOW, validUntil: LATER,
  }), (e: unknown) => e instanceof PricingInvariantError && e.invariant === "UNEXPLAINED_OPTION");
});

test("the allowance is a ceiling that still requires approval beyond it", () => {
  const s = scope();
  assert.equal(s.allowance.requiresApprovalBeyond, true,
    "a pre-authorised variance must never become a licence to expand scope");
  assert.ok(s.allowance.maxVariance.minorUnits > 0);
  assert.ok(s.exclusions.length > 0, "an unstated exclusion is a dispute waiting to happen");
});

// ---------------------------------------------------------------------------
// The money boundary
// ---------------------------------------------------------------------------

test("layers below L6 still contain no money", async () => {
  const { readFileSync } = await import("node:fs");
  const below = [
    "lib/layers/l7/commitment.ts", "lib/layers/l7/cancellation.ts",
    "lib/layers/l09a/reality.ts", "lib/layers/l09a/recovery.ts",
    "lib/layers/l09b/responsibility.ts", "lib/layers/l09b/allocation.ts",
  ];
  for (const f of below) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["Money", "minorUnits", "currency", "CAD"]) {
      assert.ok(!src.includes(bad),
        `${f} references ${bad}; L6 owns price and L12 owns the ledger — those layers deal in minutes`);
    }
  }
});
