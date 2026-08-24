# L4 — Fulfillment, Matching & Team Assembly

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_04_FULFILLMENT_MATCHING_TEAM_ASSEMBLY_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_04_FULFILLMENT_MATCHING_TEAM_ASSEMBLY_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Resolve real people, teams, availability, resources and schedule into bookable feasible fulfillment options without weakening requirements because supply is scarce.

## Owns
- Candidate retrieval
- Hard eligibility filtering
- Team assembly and roles
- Availability and capacity
- Provider/resource feasibility
- Scheduling/routing coordination
- Fulfillment Simulation
- Feasible option ranking
- Fulfillment Cost Snapshot

## Explicitly does not own
- What work is required
- Safety/rule definition
- Customer price
- Customer commitment/payment
- Execution truth
- Final settlement

## Inputs
- Requirement Contract
- RuleSet and qualifications
- Provider/team profiles
- Availability/calendars
- Resource inventory
- Customer timing/location constraints
- Pricing policy inputs

## Authoritative outputs
- FeasibleFulfillmentOptions
- TeamPlan
- RolePlan
- Schedule
- RoutePlan
- Reservation intents
- FulfillmentSimulation result
- FulfillmentCostSnapshot

## Engines / components
- Candidate Retrieval Engine
- Hard Eligibility Filter
- Availability Resolver
- Team Assembly Engine
- Role Assignment Engine
- Resource Resolver
- True-Gap Coordinator
- Scheduling Engine
- Routing Coordinator
- Fulfillment Simulator
- Feasible Option Ranker

## Main decision / operating path
1. Retrieve by geography/capability/time.
2. Apply hard eligibility before ranking.
3. Assemble team/roles.
4. Check availability/capacity.
5. Resolve resources with Layer 5.
6. Build schedule/route/reservations.
7. Run Fulfillment Simulation on actual configuration.
8. Reject infeasible options.
9. Rank feasible options by soft objectives.
10. Produce Fulfillment Cost Snapshot.

## Gates
- All hard requirements covered?
- Every role eligible?
- Schedule/route feasible?
- Critical resources reservable?
- Bookable feasibility proven?

## Data objects
- ProviderCandidate
- TeamPlan
- RoleAssignment
- AvailabilityHold
- FulfillmentPlan
- FulfillmentSimulation
- FulfillmentCostSnapshot

## Events emitted
- CandidateSet.Retrieved
- Team.Assembled
- Availability.Confirmed
- FulfillmentSimulation.Passed
- FulfillmentOption.Generated
- Fulfillment.Failed

## Events consumed
- RequirementContract.Compiled
- Rules.Classified
- ProviderProfile.Updated
- ResourceAvailability.Changed
- Cancellation.RescheduleRequested

## Failure / recovery
- No feasible option -> expand search / alternate time / return to planning only if architecture itself infeasible
- Provider decline -> rematch fulfillment, not full requirement rebuild
- Resource failure -> rerun affected fulfillment path

## Human review
- Low confidence match
- No feasible option after policy search horizon
- Team role conflict
- High-cost variance

## Security / privacy
- Provider profile access limited to matching need
- No hidden soft score may bypass hard eligibility
- Audit ranking inputs

## 1M-job scalability
- Derived geo/capability/availability search index then authoritative recheck
- Parallel candidate evaluation
- Partition by region/time
- No global serial queue

## Non-negotiable invariants
- Requirement Contract is authoritative for hard constraints
- Bookable feasibility precedes customer offer
- Provider acceptance occurs after customer authorization unless category policy requires otherwise

## Golden regression scenarios
- Two-person minimum never reduced to one because of scarcity
- Provider decline rematches only fulfillment
- No slot at requested time yields alternative feasible times

## Integrations / callbacks

- L2 Requirements
- L3 Trust/Safety
- L5 Resources
- L6 Commercial
- L7 Commitment
- L09A recovery

## Open questions
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no slot in the fixed section order and is therefore not carried in the body. Its content is: L2 Requirements, L3 Trust/Safety, L5 Resources, L6 Commercial, L7 Commitment, L09A recovery.
- Board B section 12 "LAYER PRINCIPLE / SELF-REVIEW STATUS" likewise has no slot. It records: SELF-REVIEW PASS — explicit authority boundaries, versioned inputs/outputs, deterministic gates where appropriate, failure/recovery behavior, human-review points, security/privacy controls, 1M-job logical scaling, callbacks, invariants and regression scenarios are all preserved; adjacent layers cannot silently take this layer's authority.
- Two spellings of the requirement artifact appear: "Requirement Contract" (Board A inputs, Board B invariant — 2 occurrences) and "RequirementContract" (Board B consumed event RequirementContract.Compiled — 1 occurrence). The prose spelling is more frequent so "Requirement Contract" is used in Inputs and Invariants, and the event name is kept character-for-character. Other layers (e.g. L09A) use "RequirementContract" as the artifact name; confirm whether these are the same object.
- The poster mentions only Fulfillment Simulation / FulfillmentSimulation / Fulfillment Simulator. There is no reference to Architecture Simulation anywhere on either board, so nothing about it is asserted here; the boundary between the two, if any, is defined outside this poster.
- Similar name pairs kept as printed and not normalized: output "RolePlan" vs data object "RoleAssignment"; output "FulfillmentSimulation result" vs data object "FulfillmentSimulation"; owned capability "Fulfillment Cost Snapshot" (spaced) vs artifact "FulfillmentCostSnapshot" (concatenated).
- "Reservation intents" is listed as a key output but no corresponding artifact object (e.g. a reservation/hold artifact other than AvailabilityHold) appears in Board B section 2.
- Engine E7 "True-Gap Coordinator" appears in the engine list but no step of the operating flow, gate, event or failure path references a true-gap step.
- The exemplar spec carries a "Supersedes / preserves" section; the binding section order does not include one, so none was written.
