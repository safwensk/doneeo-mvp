# L13 — Branch, Continuity, Claims & Support Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Preserve WorkCase continuity through linked JobOrders and resolve claims/support without mutating closed physical or financial truth.

## Owns
- BranchRelationship
- Prerequisite/follow-up/remediation/warranty/incident/customer-added branches
- CandidateFollowUp conversion
- WorkCase continuity
- Claims/disputes/support cases
- Remedies/appeals

## Explicitly does not own
- Rewriting OutcomeRecord (L11)
- Rewriting ledger balances/history (L12)
- Provider eligibility (L3/L4)
- Pricing (L6)
- Original requirement truth

## Inputs
- RealityCase/BranchRequest
- OutcomeRecord
- ResponsibilityAssessment
- Settlement/Ledger references
- Customer/provider messages
- Incident evidence

## Authoritative outputs
- BranchJobOrderRequest
- BranchRelationship
- ContinuityPlan
- ClaimCase
- DisputeDecision
- RemedyInstruction
- SupportTimeline

## Engines / components
- Branch Manager
- Dependency Controller
- Continuity Engine
- FollowUp Consent Engine
- Claims Case Engine
- Dispute Resolution Engine
- Remedy Engine
- Support Workflow

## Main decision / operating path
1. Classify newly discovered work as necessary current step, material prerequisite, independent follow-up, remediation, customer-added scope, incident recovery or warranty rework.
2. Create BranchRelationship only when separate JobOrder boundary is warranted.
3. PREREQUISITE_FOR blocks only dependent parent TaskBlocks; unaffected tasks continue.
4. FOLLOW_UP_TO never keeps completed parent JobOrder open.
5. CandidateFollowUp requires customer consent and normal eligibility/matching; no automatic upsell or executor reservation.
6. Claims intake locks evidence references and reconstructs timeline.
7. Apply claim/dispute policy; human review/appeal where required.
8. Financial remedy is sent to L12 as instruction; physical remediation creates/links branch through normal lifecycle.
9. Close case without rewriting L11/L12 source truth.

## Gates
- Separate JobOrder needed?
- Branch blocks which TaskBlocks?
- Customer consent for independent work?
- Claim eligible/in window?
- Appeal/manual review required?

## Data objects
- BranchRelationship
- BranchJobOrderRef
- ContinuityPlan
- CandidateFollowUp
- ClaimCase
- DisputeCase
- RemedyInstruction
- AppealRecord

## Events emitted
- Branch.Created
- Branch.BlockedParent
- Branch.Completed
- Claim.Opened
- Claim.Resolved
- Dispute.Decided
- Remedy.Issued

## Events consumed
- RealityCase.BranchRequested
- Outcome.RemediationRequired
- Customer.Complaint
- Payment.Disputed
- Incident.Reported

## Failure / recovery
- Branch dependency unresolved → only dependent scope blocked.
- Evidence conflict → manual claims review.
- Financial remedy → L12; never edit ledger directly.
- Safety-related remediation → L3 before re-execution.

## Human review
- Damage/loss claim
- High-value dispute
- Safety incident liability
- Appeal

## Security / privacy
- Need-to-know evidence access
- Redact unrelated case data
- Access audited

## 1M-job scalability
- Claims/support off critical execution path
- Async evidence retrieval
- Partition by WorkCase/Case ID

## Non-negotiable invariants
- WorkCase may outlive a JobOrder.
- Branch types: PREREQUISITE_FOR, FOLLOW_UP_TO, REMEDIATION_FOR, CUSTOMER_ADDED_SCOPE, INCIDENT_RECOVERY, WARRANTY_REWORK.
- Independent observed work never becomes current billable scope without consent.
- Claims/support consume source truth; they do not rewrite it.

## Supersedes / preserves
Supersedes the claims-only Layer 13 v1.2 poster as complete L13 authority; preserves its detailed dispute lifecycle as the Claims Case Engine subsection.

## Integrations / callbacks

- L09A Reality
- L09B Fairness
- L11 Outcome
- L12 Settlement
- P3 Identity

