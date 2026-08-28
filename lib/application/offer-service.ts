/**
 * L6 in the running system.
 *
 * Prices a fulfillment option, stores the offer, and records a selection to
 * hand to L7. Everything commercial that L6 decides passes through here; the
 * layer itself stays pure.
 *
 * The one thing this file must never do is let a stored offer be read back as
 * a settlement. It stores `total_minor_units` and nothing named `final`, and
 * L12 remains the only layer permitted to post to a ledger.
 */

import {
  composePrice, PricingInvariantError,
  type FulfillmentCostSnapshot, type PricingPolicy, type TaxDetermination,
  type PriceBand, type Money,
} from "../layers/l6/pricing";
import {
  createOffer, selectOption, isExpired,
  type CommercialOffer, type SelectedOffer, type OfferOption,
  type ScopeContract, type RoleProfile, type PaymentTopologyPolicy,
} from "../layers/l6/offer";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-requirement-contract-store";

export type PricingConfig = {
  readonly name: string;
  readonly pricing: PricingPolicy;
  readonly tax: TaxDetermination;
  readonly topology: PaymentTopologyPolicy;
};

/** One priceable configuration, as L4/L5 produced it. */
export type PriceableOption = {
  readonly band: PriceBand;
  readonly snapshot: FulfillmentCostSnapshot;
  /** How this configuration actually differs — crew, vehicle, timing. */
  readonly differsBy: string;
};

export class OfferServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "OfferServiceError";
  }
}

export class OfferService {
  constructor(
    private readonly db: D1DatabaseLike,
    private readonly config: PricingConfig,
  ) {}

  /**
   * Price every feasible option and store one offer.
   *
   * Canon: "customer sees feasible options only". Options arrive already
   * filtered for feasibility by L4/L5 — this does not second-guess that, but it
   * will refuse to price one whose cost basis is incomplete rather than
   * quietly dropping it, because a silently missing option is a customer being
   * shown less than they could have had.
   */
  async createOffer(input: {
    offerId: string;
    workCaseId: string | null;
    requirementContractRef: string;
    requirementContractVersion: number;
    options: readonly PriceableOption[];
    scopeContract: ScopeContract;
    profile: RoleProfile;
    riskProfile: string;
    jurisdiction: string;
    validFrom: string;
    validUntil: string;
    now: string;
  }): Promise<CommercialOffer> {
    if (input.options.length === 0) {
      throw new OfferServiceError("NO_FEASIBLE_OPTIONS", "L4/L5 returned no feasible configuration to price");
    }

    const priced: OfferOption[] = [];
    let provisionalCount = 0;
    let taxDecisionRef: string | null = null;

    for (const o of input.options) {
      const breakdown = composePrice({
        snapshot: o.snapshot,
        band: o.band,
        riskProfile: input.riskProfile,
        jurisdiction: input.jurisdiction,
        policy: this.config.pricing,
        tax: this.config.tax,
        now: input.now,
      });
      provisionalCount += breakdown.assumptions.length;
      taxDecisionRef ??= breakdown.taxDecisionRef;
      priced.push({
        band: o.band,
        fulfillmentOptionRef: o.snapshot.fulfillmentOptionRef,
        breakdown,
        differsBy: o.differsBy,
      });
    }

    // Review is decided on the offer as a whole, from the option a customer is
    // most likely to take, not on each option separately.
    const lead = priced.find(p => p.band === "RECOMMENDED") ?? priced[0]!;
    const review = this.config.pricing.requiresHumanReview({
      price: lead.breakdown.total,
      cost: lead.breakdown.directCost,
      provisionalComponents: provisionalCount,
      jurisdiction: input.jurisdiction,
    });

    const offer = createOffer({
      offerId: input.offerId,
      requirementContractRef: input.requirementContractRef,
      requirementContractVersion: input.requirementContractVersion,
      options: priced,
      scopeContract: input.scopeContract,
      profile: input.profile,
      topologyPolicy: this.config.topology,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      review,
    });

    await this.db.batch([this.insertOffer(offer, input.workCaseId, taxDecisionRef, input.now)]);
    return offer;
  }

  /**
   * Select a band and hand it to L7.
   *
   * The version check is done against the RequirementContract as it stands at
   * this moment, not against whatever the caller believes — a caller who has
   * been holding a stale offer is exactly who this gate exists for.
   */
  async select(input: {
    offerId: string;
    band: PriceBand;
    now: string;
  }): Promise<SelectedOffer> {
    const offer = await this.read(input.offerId);
    if (!offer) throw new OfferServiceError("NO_OFFER", `no offer ${input.offerId}`);

    // A RequirementContract reference is `contractId@version`; the stored key
    // is the contractId alone. Only PUBLISHED versions count — a draft is not
    // a plan anyone agreed to, and pricing against one would be pricing against
    // a guess.
    const at = offer.requirementContractRef.lastIndexOf("@");
    const contractId = at === -1 ? offer.requirementContractRef : offer.requirementContractRef.slice(0, at);
    const current = await this.db.prepare(
      `SELECT version FROM requirement_contracts
       WHERE contract_id = ? AND status = 'PUBLISHED'
       ORDER BY version DESC LIMIT 1`,
    ).bind(contractId).first<{ version: number }>();

    const selected = selectOption({
      offer,
      band: input.band,
      currentRequirementContractVersion: current?.version ?? offer.requirementContractVersion,
      now: input.now,
    });

    await this.db.batch([
      this.db.prepare(
        `INSERT INTO offer_selections
         (offer_id, band, fulfillment_option_ref, total_minor_units, currency, selected_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(offer_id) DO NOTHING`,
      ).bind(selected.offerId, selected.band, selected.fulfillmentOptionRef,
        selected.total.minorUnits, selected.total.currency, selected.selectedAt),
    ]);
    return selected;
  }

  async read(offerId: string): Promise<CommercialOffer | null> {
    const row = await this.db.prepare(
      `SELECT offer_id, requirement_contract_ref, requirement_contract_version, options_json,
              scope_contract_json, payment_topology, valid_from, valid_until,
              requires_human_review, review_reason
       FROM commercial_offers WHERE offer_id = ?`,
    ).bind(offerId).first<{
      offer_id: string; requirement_contract_ref: string; requirement_contract_version: number;
      options_json: string; scope_contract_json: string; payment_topology: string;
      valid_from: string; valid_until: string; requires_human_review: number; review_reason: string | null;
    }>();
    if (!row) return null;

    return Object.freeze({
      offerId: row.offer_id,
      requirementContractRef: row.requirement_contract_ref,
      requirementContractVersion: row.requirement_contract_version,
      options: Object.freeze(JSON.parse(row.options_json) as OfferOption[]),
      scopeContract: JSON.parse(row.scope_contract_json) as ScopeContract,
      paymentTopology: row.payment_topology as CommercialOffer["paymentTopology"],
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      requiresHumanReview: row.requires_human_review === 1,
      reviewReason: row.review_reason,
      isFinalSettlement: false,
    });
  }

  /** Offers a customer may still be shown. Expiry is a fact, not a policy call. */
  async liveOffersFor(requirementContractRef: string, now: string): Promise<CommercialOffer[]> {
    const rows = await this.db.prepare(
      `SELECT offer_id FROM commercial_offers WHERE requirement_contract_ref = ? ORDER BY created_at DESC`,
    ).bind(requirementContractRef).all<{ offer_id: string }>();
    const out: CommercialOffer[] = [];
    for (const r of rows.results ?? []) {
      const offer = await this.read(r.offer_id);
      if (offer && !isExpired(offer, now)) out.push(offer);
    }
    return out;
  }

  private insertOffer(
    offer: CommercialOffer, workCaseId: string | null,
    taxDecisionRef: string | null, now: string,
  ): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO commercial_offers
       (offer_id, work_case_id, requirement_contract_ref, requirement_contract_version,
        options_json, scope_contract_json, payment_topology, pricing_policy_name,
        tax_decision_ref, valid_from, valid_until, requires_human_review, review_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      offer.offerId, workCaseId, offer.requirementContractRef, offer.requirementContractVersion,
      JSON.stringify(offer.options), JSON.stringify(offer.scopeContract),
      offer.paymentTopology, this.config.name, taxDecisionRef,
      offer.validFrom, offer.validUntil, offer.requiresHumanReview ? 1 : 0,
      offer.reviewReason, now,
    );
  }
}

export { PricingInvariantError };
export type { Money };
