# P1 — Platform Orchestrator, Workflow & State Control

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_P1_PLATFORM_ORCHESTRATOR_WORKFLOW_STATE_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_P1_PLATFORM_ORCHESTRATOR_WORKFLOW_STATE_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Provide durable workflow coordination, command/event routing, version lineage, idempotency, concurrency control, sagas and callbacks while preserving domain ownership.

## Owns
- Workflow coordination
- State transition guards
- Command routing
- Event orchestration
- Version lineage
- Sagas/compensation
- Idempotency/concurrency
- Human-review routing

## Explicitly does not own
- Planning/safety/pricing/fulfillment/outcome domain decisions
- Direct ledger edits
- Arbitrary cross-domain writes

## Inputs
- Commands/events from all layers
- Current aggregate versions
- Policy for routing/retries
- Human review decisions

## Authoritative outputs
- State transitions
- Command acknowledgements
- Domain event envelopes
- Saga state
- Idempotency records
- Review tasks

## Engines / components
- E1 Command Router
- E2 Event Orchestrator
- E3 State Machine Coordinator
- E4 Version/Lineage Manager
- E5 Saga Manager
- E6 Idempotency Controller
- E7 Concurrency Controller
- E8 Review Router

## Main decision / operating path
1. Receive command
2. Validate caller/version/state
3. Route to smallest correct owner
4. Persist idempotency/transition intent
5. Domain performs decision
6. Consume resulting event
7. Advance workflow/saga
8. Retry/compensate on failure
9. Publish read-model update

## Gates
- Expected version matches?
- Transition allowed?
- Command duplicate?
- Compensation required?
- Human review pending?

## Data objects
- CommandEnvelope
- EventEnvelope
- StateTransition
- SagaState
- IdempotencyKey
- ReviewTask
- VersionRef

## Events emitted
- Workflow.Advanced
- Saga.Compensated
- Review.Requested
- Command.RejectedStaleVersion

## Events consumed
- All domain events

## Failure / recovery
- At-least-once duplicate -> idempotent consumer
- Stale version -> reject/reload
- Partial saga -> compensating action
- Downstream unavailable -> queue/retry/DLQ

## Human review
- Cross-domain manual review
- Irreversible high-impact action
- Repeated saga failure

## Security / privacy
- Service identity/auth
- Audit command actors
- No secrets in events
- Least privilege event consumers

## 1M-job scalability
- Logical boundaries separable later; modular monolith now
- WorkCase-scoped ordering
- Transactional outbox/inbox
- No global serial queue

## Non-negotiable invariants
- Orchestrator coordinates; domains decide
- No God Object
- Design for failure
- Commands and events are distinct

## Golden regression scenarios
- Duplicate payment command no duplicate capture
- Stale RC version rejected
- Provider decline saga rematches fulfillment without changing requirement

## Integrations / callbacks

- All layers
- P2 Data
- P3 Identity
- P4 Event backbone

## Open questions
- Board B section 9 "INTEGRATIONS / CALLBACKS" lists "All layers", "P2 Data", "P3 Identity" and "P4 Event backbone". The mandated section order has no integrations/callbacks heading, so this content is currently dropped from the published spec. Confirm whether an "Integrations / callbacks" section should be added to the format or whether these belong under Inputs/Events.
- Board B names the event backbone layer "P4 Event backbone". The reconciled P2 spec in this set attributes event transport to P6 ("P6 owns event transport, not P2", "Event transport/backbone (P6)"), and the source poster set contains both Doneeo_P4_EVENT_AI_OBSERVABILITY_1M_JOB_SCALE and a P6-titled reconciled spec. P1's poster only ever says P4, so P4 is preserved verbatim here. Confirm which layer ID the mechanical cross-layer link check expects for the event backbone.
- Golden regression scenario 2 is "Stale RC version rejected". "RC" is never expanded anywhere in either board. If it means `RequirementContract` (the artifact named in adjacent layers), the executable test needs that confirmed — the abbreviation is preserved verbatim as required by rule 4.
- Golden regression scenario 1 is "Duplicate payment command no duplicate capture" with no verb between "command" and "no". This reads as poster shorthand for "duplicate payment command produces no duplicate capture"; it is transcribed verbatim. Confirm the intended reading before it is turned into a test.
- Board A section 6 prefixes each component with an engine ID (E1–E8). These IDs are preserved inline in Engines / components since the format allows no nesting; confirm whether the link check expects bare component names.
- Board B section 12 records "SELF-REVIEW PASS" with a layer-principle statement. There is no section for it in the mandated order, so it is not carried through.
- The other specs in this set end with a "Supersedes / preserves" section. SPEC_FORMAT.md's exact section order does not include it, so it is omitted here. Confirm whether P1 needs one for drop-in compatibility.
- The poster title is "PLATFORM ORCHESTRATOR, WORKFLOW & STATE ARCHITECTURE" while the mandated heading for this spec is "Platform Orchestrator, Workflow & State Control". The mandated heading is used; noting the divergence in case titles are matched mechanically.
