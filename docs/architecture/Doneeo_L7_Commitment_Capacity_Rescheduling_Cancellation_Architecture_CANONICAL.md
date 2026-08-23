# L7 — Commitment, Capacity, Rescheduling & Cancellation Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Protect real customer/provider commitments while keeping rescheduling and cancellation fair, requestable and evidence-based.

## Owns
- Customer commitment state
- Provider acceptance state
- CapacityReservation per assigned role/person/resource
- PreparationRecord
- CommitmentSnapshot
- Reschedule strategy
- Capacity recovery/backfill
- Cancellation request and reconciliation

## Explicitly does not own
- Price calculation (L6)
- Final customer charge/provider payable/ledger (L12)
- Responsibility adjudication (09B)
- Execution truth (L10)
- Claims/disputes (L13)

## Inputs
- ScopeContract/selected offer
- Provider/team availability
- Resource reservations
- Payment authorization status from P9/L12 boundary
- Current JobOrder state
- Configurable cancellation policy
- 09B ResponsibilityAssessment when needed

## Authoritative outputs
- CommitmentConfirmation
- CapacityReservation
- RescheduleOptions
- CommitmentSnapshot
- CapacityRecoveryAttempt
- CancellationSettlementInstruction

## Engines / components
- Commitment State Engine
- Provider Acceptance Coordinator
- Capacity Reservation Engine
- Preparation Tracker
- Reschedule Engine
- Capacity Recovery Engine
- Cancellation Policy Engine
- Cancellation Reconciliation Engine

## Main decision / operating path
1. Customer selects ScopeContract and authorizes payment method/amount without implying capture/completion.
2. Provider acceptance creates capacity reservation for each role/resource.
3. Commitment state hardens according to configurable policy and actual preparation/mobilization.
4. Reschedule requests preserve same provider/team/resources first where feasible.
5. Cancellation request freezes new commitments and takes a CommitmentSnapshot.
6. Attempt capacity recovery/backfill before calculating lost reserved capacity.
7. Use evidence/policy/09B responsibility where economic allocation is contested or reality-caused.
8. Show customer applicable consequences before final cancel where policy permits.
9. Send release/refund/capture instructions to L12; L7 never edits ledger.

## Gates
- Cancellation remains requestable at every stage.
- Reschedule preservation feasible?
- Capacity successfully recovered?
- Costs real/evidenced/policy-eligible?
- High-value/disputed responsibility requires 09B/L13/manual review?

## Data objects
- CapacityReservation
- PreparationRecord
- CommitmentState
- CommitmentSnapshot
- CapacityRecoveryAttempt
- ReschedulePlan
- CancellationRequest
- CancellationSettlementInstruction

## Events emitted
- Capacity.Held
- Provider.Accepted
- Commitment.Hardened
- Reschedule.Proposed
- Cancellation.Requested
- CapacityRecovery.Completed
- Cancellation.Reconciled

## Events consumed
- CommercialOffer.Selected
- Payment.AuthorizationUpdated
- Provider.Declined
- RealityCase.Unrecoverable
- Execution.Started

## Failure / recovery
- Provider decline → L4 rematch, not L2 replan.
- Resource failure → L5 recovery.
- Customer reschedule → preserve assignment where feasible.
- Cancellation → reconcile actual protected commitment, never automatically full unperformed job.
- Backfill lowers Net Lost Reserved Capacity.

## Human review
- High-value cancellation
- Disputed economic responsibility
- Policy exception
- Fraud/abuse signal

## Security / privacy
- Clear customer disclosure
- No hidden fee logic
- Provider earnings remain private
- Audit every commitment change

## 1M-job scalability
- Region/time-partitioned capacity indexes
- Async backfill workers
- Event-driven commitment state
- Policy thresholds/configuration cached and versioned

## Non-negotiable invariants
- No universal cancellation hours/percentages are canonical.
- Cancellation remains requestable.
- Voluntary cancellation ≠ Field Reality Block.
- Provider Protected Payable and customer liability are different quantities.
- Net Lost Reserved Capacity = Reserved Capacity − Successfully Reallocated Capacity.
- Customer never automatically pays full original price for unperformed work.

## Supersedes / preserves
Supersedes the detailed Layer 7 v1.0 poster wherever it shows fixed fee schedules/windows or payment capture as a universal pre-execution sequence. Preserves its capacity/rescheduling mechanics.

## Integrations / callbacks

- L4 Fulfillment
- L5 Resources
- L6 Commercial
- L8 Preflight
- L09B Fairness
- L12 Settlement
- L13 Claims

