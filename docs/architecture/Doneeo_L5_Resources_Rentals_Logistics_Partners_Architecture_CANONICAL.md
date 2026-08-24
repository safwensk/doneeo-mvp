# L5 — Resources, Rentals, Logistics & Partners

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_05_RESOURCES_RENTALS_LOGISTICS_PARTNERS_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_05_RESOURCES_RENTALS_LOGISTICS_PARTNERS_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Identify, source, reserve and coordinate tools, equipment, materials, vehicles, rentals, purchases and partner services using true-gap logic.

## Owns
- Resource inventory/compatibility
- True-gap calculation
- Rental/purchase/partner sourcing
- Reservation
- Pickup/delivery/return coordination
- Resource readiness and receipts

## Explicitly does not own
- Task requirements
- Provider/team matching
- Customer pricing
- Cancellation responsibility
- Execution of task itself
- Settlement authority

## Inputs
- AbstractResourcePlan
- Selected team assets
- Customer-owned resources
- Partner/rental inventory
- Location/time/route context
- Capability/safety requirements

## Authoritative outputs
- ResourcePlan
- Reservation records
- Pickup/Delivery/Return plan
- ResourceCostEstimate
- ResourceProof/Receipts
- TrueGap status

## Engines / components
- Resource Inventory Engine
- Asset Compatibility Engine
- True-Gap Resolver
- Rental/Purchase Optimizer
- Partner Availability Engine
- Reservation Engine
- Pickup/Return Route Engine

## Main decision / operating path
1. Normalize required resources
2. Check customer-owned
3. Check selected provider/team assets
4. Check shared/internal pool
5. Calculate remaining true gap
6. Search partner/rental/purchase/delivery options
7. Compare time+cost+route+risk
8. Reserve best feasible option
9. Plan pickup/delivery/return
10. Confirm receipt/readiness
11. Feed actuals to execution/settlement

## Gates
- Resource compatible?
- Available in required time window?
- Route/return obligations feasible?
- Resource changes capability/safety classification?

## Data objects
- ResourceRequirement
- ResourceInventoryItem
- ResourceOption
- Reservation
- PickupPlan
- ReturnPlan
- Receipt
- ActualResourceCost

## Events emitted
- Resource.GapDetected
- Resource.Reserved
- Resource.Delivered
- Resource.Collected
- Resource.ReceiptUploaded
- Resource.CostUpdated

## Events consumed
- Fulfillment.TeamSelected
- RequirementContract.Compiled
- RealityCase.Created
- Execution.PreflightRequested
- Cancellation.Requested

## Failure / recovery
- Supplier unavailable -> alternate source
- Reservation expired -> rebook and revalidate fulfillment
- Wrong item -> replace before execution
- Late delivery -> reroute/adjust or escalate

## Human review
- High-cost/specialized asset
- Multi-leg logistics
- Permit/access-dependent resource
- No viable source

## Security / privacy
- Protect supplier/customer data
- Track serials/high-value assets where needed
- Audit reservations and receipts

## 1M-job scalability
- Cached supplier catalogs
- Async partner queries
- Region-local inventory indexes
- Idempotent reservation commands

## Non-negotiable invariants
- Check customer -> provider/team -> partner/rental/purchase
- Rental pickup/return is not working time unless policy explicitly says otherwise
- No arbitrary executor-added resource charge

## Golden regression scenarios
- Customer owns required drill so no rental
- Team member asset closes true gap
- On-site missing fitting triggers resource recovery and actual receipt

## Integrations / callbacks

- L2 Resources
- L4 Fulfillment
- L6 Commercial
- L7 Commitment
- L8 Preflight
- L09A Reality
- L12 Settlement

## Open questions
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no corresponding section in the canonical format, so its content is recorded here rather than dropped: L2 Resources, L4 Fulfillment, L6 Commercial, L7 Commitment, L8 Preflight, L09A Reality, L12 Settlement. Note that the poster labels the L2 callback "L2 Resources" although L2 is the Intelligence/Planning layer and L5 is the Resources layer — possible poster typo, unresolved from source.
- Board B section 12 "LAYER PRINCIPLE / SELF-REVIEW STATUS" (self-review pass statement) likewise has no section in the canonical format and is not carried into the spec body.
- The poster writes the concept three ways — "true-gap logic"/"True-gap calculation"/"True-Gap Resolver" (hyphenated), "true gap" (flow step 5 and golden scenario 2, unhyphenated), and "TrueGap status" (output artifact, closed-form). All three are preserved exactly as the poster uses them; if a single mechanical artifact name is required, "TrueGap" is the only closed-form spelling.
- Board A engine numbering (E1–E7) is present in the poster but not carried, matching the exemplar's unnumbered engine list.
- Board A lists "AbstractResourcePlan" as an input and "ResourcePlan" as an output; the poster does not state whether these are the same object at different stages or two distinct artifacts.
- The poster names "Reservation" both as a data object and "Reservation records" as an authoritative output; the relationship between the two is not stated.
