# L6 — Commercial Offer & Pricing

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_06_COMMERCIAL_OFFER_PRICING_ARCHITECTURE_FULL_DETAIL_v1.2_A.txt (Board A) + Doneeo_06_COMMERCIAL_OFFER_PRICING_ARCHITECTURE_FULL_DETAIL_v1.2_B.txt (Board B)

## Purpose
Create customer-facing price/scenario offers and an immutable Scope Contract from feasible fulfillment inputs, without owning final settlement or responsibility allocation.

## Owns
- Pricing strategy/policy
- Cost composition
- Scenario pricing
- Tax determination interface
- ScopeContract
- Commercial validity/expiry
- Payment topology policy selection

## Explicitly does not own
- Provider eligibility
- Customer authorization/capture
- Cancellation reconciliation
- Outcome truth
- Final customer charge/provider payable
- Ledger

## Inputs
- Requirement Contract
- Feasible fulfillment option
- FulfillmentCostSnapshot
- ResourceCostEstimate
- Location/jurisdiction
- Pricing/tax policy
- Risk/complexity profile

## Authoritative outputs
- CommercialOffer
- ScopeContract
- Price breakdown
- Taxes/fees
- Allowances/preauthorized minor variance
- Validity window
- PaymentTopologyPolicy

## Engines / components
- Cost Composition Engine
- Pricing Engine
- Tax Determination Interface
- Scenario Pricing Engine
- Scope Contract Engine
- Commercial Offer Generator
- Payment Topology Policy Engine

## Main decision / operating path
1. Take feasible fulfillment option
2. Compose direct/indirect costs
3. Apply pricing policy/margin
4. Determine tax basis
5. Build budget/recommended/full-service options where meaningful
6. Attach assumptions and validity
7. Create immutable Scope Contract
8. Present transparent commercial offer
9. Hand off selected offer to Layer 7

## Gates
- Floor/cap policy satisfied?
- Tax decision available?
- Offer still within validity?
- Price corresponds to same RC/fulfillment versions?

## Data objects
- CommercialOffer
- ScopeContract
- PriceBreakdown
- TaxDecisionRef
- Allowance
- PriceLockToken
- PaymentTopologyPolicy

## Events emitted
- CommercialOffer.Created
- CommercialOffer.Expired
- PriceOption.Selected
- ScopeContract.Created

## Events consumed
- FulfillmentOption.Generated
- ResourceCost.Updated
- Rules.Updated
- Promotion.Updated

## Failure / recovery
- Missing cost input -> conservative range or block offer
- Tax uncertainty -> manual review / external authority
- Expired quote -> reprice from current fulfillment snapshot

## Human review
- Large discount/policy override
- Unusual tax/jurisdiction
- Very low pricing confidence
- High-value custom scenario

## Security / privacy
- No exposure of provider private cost detail beyond policy
- Audit pricing rule versions
- Role-based commercial access

## 1M-job scalability
- Stateless pricing workers
- Versioned price policies
- Cache tax/rate data with validity
- Async generation for complex scenarios

## Non-negotiable invariants
- Customer sees feasible options only
- Offer is based on known facts and stated assumptions
- Offer price is not final settlement after reality changes

## Golden regression scenarios
- Expired rental quote forces offer refresh
- Budget/recommended options differ in real feasible configuration
- Payment topology selected by contract role profile

## Integrations / callbacks

- L2 Requirements
- L4 Fulfillment
- L5 Resources
- L7 Commitment
- L12 Settlement references

## Open questions
- Artifact spelling conflict: the poster uses both `Scope Contract` (header blurb, Purpose, OWNS, flow step 7) and `ScopeContract` (KEY OUTPUTS, Board B data objects, `ScopeContract.Created`). Counts are near-even (4 vs 3). I used `ScopeContract` for the artifact in Owns / Authoritative outputs / Data objects because that is the machine-comparable form used in the event name and by adjacent layers, kept `Scope Contract` verbatim inside the Purpose sentence, and kept `Scope Contract Engine` verbatim as the engine name. Confirm which form is canonical.
- The poster's KEY INPUTS says `Requirement Contract` (spaced). Other layers in the set reference `RequirementContract`. Preserved as written; confirm whether these are the same artifact.
- The gate "Price corresponds to same RC/fulfillment versions?" abbreviates the requirement contract as `RC`. Preserved verbatim; expansion not stated on the poster.
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no home in the mandated section order, so its content is not in the spec body. It reads: L2 Requirements; L4 Fulfillment; L5 Resources; L7 Commitment; L12 Settlement references. If the canonical format ever gains an integrations section, this is the source content.
- The poster names `PaymentTopologyPolicy` as both an authoritative output and a data object, and lists "Payment topology policy selection" under OWNS, but never states the selection criteria beyond the golden scenario "Payment topology selected by contract role profile". No topology values are enumerated.
- Board A DOES NOT OWN covers customer authorization/capture, final customer charge/provider payable, and ledger — i.e. L6 sets price but does not move money. The poster does not name the layer that does (L7 Commitment and L12 Settlement appear only in the integrations list and flow step 9).
- Allowances/preauthorized minor variance is an output and `Allowance` is a data object, but the poster gives no threshold, unit, or authority for setting them.
- `PriceLockToken` appears only in Board B data objects — no event, gate, or flow step references it, so its lifecycle (issue, honor, expire) is unspecified.
- Board B section 12 records "SELF-REVIEW PASS" with the note that adjacent layers cannot silently take this layer's authority. There is no section in the mandated order for self-review status; not carried into the body.
