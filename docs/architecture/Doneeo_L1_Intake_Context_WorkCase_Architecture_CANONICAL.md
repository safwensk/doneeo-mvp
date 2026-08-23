# L1 — Intake, Context & WorkCase

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_01_INTAKE_CONTEXT_WORKCASE_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_01_INTAKE_CONTEXT_WORKCASE_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Capture the customer's messy real-world problem, context and initial evidence in a durable WorkCase without prematurely estimating, matching or deciding execution.

## Owns
- WorkCase creation and identity
- Original request and normalized intake
- Customer goal / desired outcome
- Context capture: location, timing, access, recipients
- Initial evidence and attachment references
- Continuity link to future JobOrders/branches

## Explicitly does not own
- Task architecture or Requirement Contract
- Provider selection or availability
- Safety/legal final decisions
- Pricing or payment
- Execution control
- Outcome verification

## Inputs
- Customer text/voice/photo/file input
- Account/identity context
- Known locations and timing
- Prior WorkCase context if explicitly linked
- Recipient/access details when provided

## Authoritative outputs
- WorkCase
- NormalizedRequest
- Initial Fact Ledger entries
- Evidence references
- Customer objective
- Context snapshot
- PlanningStarted command

## Engines / components
- Input Normalizer
- Context Capture Engine
- Evidence Intake Engine
- WorkCase Manager
- Objective Resolver
- Recipient/Access Context Resolver

## Main decision / operating path
1. Receive I Need Help request
2. Create WorkCase ID
3. Normalize content and channels
4. Capture stated facts and evidence
5. Resolve customer objective
6. Record context and provenance
7. Hand off to Layer 2 Intelligence

## Gates
- WorkCase identity valid?
- Customer consent/access valid?
- Enough input to begin semantic interpretation?

## Data objects
- WorkCase
- NormalizedRequest
- ContextSnapshot
- EvidenceRef
- CustomerObjective
- RecipientContext

## Events emitted
- WorkCase.Created
- Evidence.Uploaded
- Context.Updated
- PlanningRequested

## Events consumed
- Customer.MessageReceived
- Identity.ContextResolved
- PriorWorkCase.Linked

## Failure / recovery
- Duplicate request -> idempotent reuse/new version
- Attachment unavailable -> preserve reference and request retry
- Conflicting locations/times -> record conflict for Layer 2
- Partial input -> create WorkCase anyway; planning determines MSI

## Human review
- Identity ambiguity
- Third-party recipient authority ambiguity
- Conflicting customer ownership/authorization

## Security / privacy
- Minimize collected data
- Evidence access scoped to WorkCase roles
- Explicit consent for third-party recipient sharing
- Encryption in transit/at rest

## 1M-job scalability
- Stateless intake workers
- WorkCase-partitioned writes
- Object storage for media
- Async enrichment allowed; customer acknowledgment remains low latency

## Non-negotiable invariants
- No plan/estimate/match before Layer 2
- Original customer input remains immutable source evidence
- WorkCase is continuity container; JobOrder is not created here

## Golden regression scenarios
- Multi-part request preserved as one WorkCase
- Third-party recipient captured without over-sharing
- Duplicate submit does not duplicate WorkCase

## Integrations / callbacks

- P3 Identity/Consent
- P2 Fact Ledger/Evidence
- L2 Intelligence
- P1 Orchestrator

## Open questions
- Board B section 9 "INTEGRATIONS / CALLBACKS" lists P3 Identity/Consent, P2 Fact Ledger/Evidence, L2 Intelligence and P1 Orchestrator. The mandated section order has no integrations/callbacks heading, so this content is currently dropped from the published spec. Confirm whether an "Integrations / callbacks" section should be added to the format or whether these belong under Inputs/Events.
- Board A section 3 spells the artifact as "Requirement Contract" (with a space); the rest of the Atlas set uses `RequirementContract`. Only the spaced form appears in this poster, so it is preserved verbatim here. Confirm which spelling the mechanical cross-layer link check expects.
- Board A output 5 is "Customer objective" and output 6 is "Context snapshot" (sentence case), while Board B section 2 names the same artifacts `CustomerObjective` and `ContextSnapshot`. Both forms are preserved in their own sections per the poster; confirm the canonical casing.
- Board A output 7 is "PlanningStarted command" while Board B section 3 emits `PlanningRequested`. These may be two names for the same hand-off or two distinct things; the poster does not say.
- The other specs in this set end with a "Supersedes / preserves" section. SPEC_FORMAT.md's exact section order does not include it, so it is omitted here. Confirm whether L1 needs one for drop-in compatibility.
- Board B section 12 records "SELF-REVIEW PASS" with a layer-principle statement. There is no section for it in the mandated order, so it is not carried through.
- "MSI" is referenced in the failure/recovery line ("planning determines MSI") but is never expanded or defined anywhere in either board.
