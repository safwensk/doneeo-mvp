# L11 — Outcome, Completion & Evidence Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Establish authoritative physical outcome by verifying execution evidence against the approved Completion Specification and requirement/change versions.

## Owns
- Completion submission validation
- Completion Specification verification
- Evidence integrity
- TaskBlockCompletionDecision
- JobOrderCompletionDecision
- VerifiedActuals
- OutcomeRecord
- Actual-vs-estimate variance report

## Explicitly does not own
- Customer charge/provider payable
- Responsibility allocation
- Claims adjudication
- New planning except explicit remediation/reality callbacks

## Inputs
- CompletionSubmission
- CompletionSpecification
- RequirementContract version
- Approved recovery/change versions
- ExecutionJournal
- Evidence
- Actual time/resources/materials
- Customer/recipient acknowledgement

## Authoritative outputs
- TaskBlockCompletionDecision
- JobOrderCompletionDecision
- OutcomeRecord
- VerifiedActuals
- SettlementInput
- OutcomeReport
- RemediationRequest

## Engines / components
- Submission Validator
- Completion Specification Validator
- Evidence Validator
- Outcome Verifier
- Variance Reporter
- Customer Acknowledgement Engine
- Outcome Recording Engine

## Main decision / operating path
1. Receive submission from L10; 'Done' is only a submission signal.
2. Validate required evidence and integrity.
3. For each TaskBlock compare actuals to Completion Specification success criteria/postconditions.
4. Record TaskBlock completion: verified complete / partial / verification failed / remediation required / disputed.
5. Evaluate JobOrder completion eligibility across contracted scope and approved changes.
6. Customer acknowledgement is evidence; non-response cannot leave job indefinitely open when objective evidence suffices.
7. If new physical fact appears, call 09A.
8. If economic responsibility issue exists, call 09B.
9. If remediation/dispute required, call L13.
10. Publish VerifiedActuals/SettlementInput directly to L12 for normal completion.
11. Close JobOrder only when contracted scope + approved changes satisfy closure policy; WorkCase may remain open for branches.

## Gates
- Required evidence present?
- Completion Specification satisfied?
- TaskBlock dependencies complete?
- JobOrder completion eligible?
- Dispute/remediation required?

## Data objects
- CompletionSubmission
- TaskBlockCompletionDecision
- JobOrderCompletionDecision
- OutcomeRecord
- EvidenceBundle
- VerifiedActuals
- VarianceRecord
- SettlementInput

## Events emitted
- Outcome.TaskBlockVerified
- Outcome.JobOrderCompletionEligible
- Outcome.RemediationRequired
- Outcome.Disputed
- SettlementInput.Ready

## Events consumed
- Completion.Submitted
- RecoveryDecision.Approved
- RequirementContract.Updated
- Customer.Acknowledged

## Failure / recovery
- Missing evidence → request specific evidence.
- Failed criterion → correction/remediation path.
- Customer unavailable → objective evidence/policy.
- Dispute → L13.

## Human review
- High-value outcome
- Conflicting evidence
- Safety incident tied to completion
- Customer rejection with evidence conflict

## Security / privacy
- Evidence immutable after lock.
- Read-only customer/provider evidence views.
- Retention by evidence type.

## 1M-job scalability
- Parallel TaskBlock verification
- Async media checks
- No AI-only authority for hard completion criteria

## Non-negotiable invariants
- Completion Specification is the central success authority.
- Customer acceptance is evidence, not sole authority.
- Done/Submit ≠ Completed.
- Blocked execution is not automatically a terminal outcome.
- Cancelled is final only when L7 finalizes cancellation.
- JobOrder closure ≠ WorkCase closure.
- Actual cost facts are not automatically customer charges.

## Supersedes / preserves
Supersedes Layer 11 v1.2 where it treats generic plan-vs-actual/customer acceptance/blocked state as sufficient completion authority. Preserves its evidence, immutable OutcomeRecord and routing mechanics.

## Integrations / callbacks

- L10 Execution
- L12 Settlement
- L13 Branch/Claims
- P2 Evidence

