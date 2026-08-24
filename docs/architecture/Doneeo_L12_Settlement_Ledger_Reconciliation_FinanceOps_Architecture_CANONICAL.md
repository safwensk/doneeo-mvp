# L12 — Settlement, Ledger, Reconciliation & FinanceOps

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_12_SETTLEMENT_LEDGER_RECONCILIATION_FINANCEOPS_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_12_SETTLEMENT_LEDGER_RECONCILIATION_FINANCEOPS_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Calculate final customer charge, provider payable, refunds/releases, taxes and ledger postings from verified actuals and responsibility decisions, with append-only accounting and reconciliation.

## Owns
- Final settlement calculation
- Payment capture/release/refund coordination
- Provider payable
- Tax settlement references
- Append-only double-entry ledger
- Reconciliation
- FinanceOps exceptions/holds/retries/reversals

## Explicitly does not own
- Work planning
- Safety qualification
- Outcome truth
- Claims physical truth
- Editable balances/history

## Inputs
- ScopeContract
- Payment authorization state
- Outcome SettlementInput
- 09B responsibility allocation
- CancellationSettlementInstruction
- Resource actuals/receipts
- TaxDecision refs

## Authoritative outputs
- FinalCustomerCharge
- ProviderPayable
- Refund/ReleaseInstruction
- LedgerEntries
- ReconciliationRecord
- FinanceException

## Engines / components
- Settlement Engine
- Customer Charge Engine
- Provider Payable Engine
- Payment Adapter Coordinator
- Refund/Release Engine
- Tax Settlement Engine
- Ledger Posting Engine
- Reconciliation Engine
- FinanceOps Exception Engine

## Main decision / operating path
1. Load immutable commercial/outcome/responsibility inputs.
2. Calculate customer charge: completed contracted work + approved additions + eligible customer-responsible disruption + approved resource actuals − credits − unperformed amounts.
3. Calculate provider payable independently: completed work + policy-eligible preparation/mobilization/diagnosis + net protected capacity + eligible external costs.
4. Determine capture/release/refund.
5. Post balanced append-only ledger entries.
6. Execute PSP instructions idempotently.
7. Ingest callbacks.
8. Reconcile PSP/bank/ledger.
9. Create FinanceOps exceptions.
10. Close financial state when reconciled.
11. Integrate/callback with L6 Commercial, L7 Cancellation, L09B Fairness, L11 Outcome, L13 Claims and P1/P2.

## Gates
- Outcome verified or approved partial close?
- Customer charge policy-compliant?
- Ledger balanced?
- Idempotency key seen?
- External settlement reconciled?

## Data objects
- PaymentAuthorization
- Capture
- Refund
- ProviderPayable
- LedgerEntry
- LedgerTransaction
- ReconciliationRecord
- FinanceException

## Events emitted
- Settlement.Calculated
- Payment.Captured
- Refund.Issued
- ProviderPayable.Created
- Ledger.Posted
- Reconciliation.Completed
- FinanceException.Opened

## Events consumed
- SettlementInput.Ready
- Responsibility.Assessed
- Cancellation.Reconciled
- PSP.CallbackReceived
- Bank.SettlementReceived

## Failure / recovery
- Callback lost → inbox/outbox replay.
- Duplicate webhook → dedupe.
- PSP failure → retry/hold.
- Reconciliation mismatch → FinanceOps exception.
- Never direct-edit balances.

## Human review
- High-value adjustment
- Chargeback/dispute
- Tax ambiguity
- Repeated PSP failure
- Reconciliation break

## Security / privacy
- PCI/tokenization boundaries
- Finance role access
- Append-only audit
- No raw secrets in logs

## 1M-job scalability
- Persistent idempotency
- Transactional inbox/outbox
- Independent payment/reconciliation workers
- Partition ledger by legal/entity policy while preserving balanced books

## Non-negotiable invariants
- Payment never implies safe/assigned/ready/completed.
- Customer charge ≠ provider payable.
- FinanceOps cannot rewrite physical truth or ledger history.
- No direct DB edits.
- Doneeo/partner share absorbs platform/partner responsibility and Recovery Credits without silently shifting it to customer or executor.
- Append-only balanced postings; idempotent PSP commands; transactional inbox/outbox; reconciliation; FinanceOps exceptions; no direct balance edits.

## Special control — FINAL SETTLEMENT TRUTH

- Customer final charge
- Completed contracted work + approved additions + eligible customer-responsible disruption + approved resource actuals − credits − unperformed amounts.
- Provider payable
- Completed work + policy-eligible preparation/mobilization/diagnosis + net protected capacity + eligible external costs.
- Doneeo / partner share
- Absorb platform/partner responsibility and Recovery
- Credits without silently shifting it to customer or executor.
- Ledger & reconciliation
- Append-only balanced postings; idempotent PSP commands; transactional inbox/outbox; reconciliation; FinanceOps exceptions; no direct balance edits.

## Golden regression scenarios
- Provider paid while Doneeo absorbs planning error
- Unused authorization released after partial close
- Lost callback replay causes no duplicate financial effect

## Integrations / callbacks

- L6 Commercial
- L7 Cancellation
- L09B Fairness
- L11 Outcome
- L13 Claims
- P1/P2

## Open questions
- The poster never names P9 (or any external-rail layer). Flow step 6 says only "Execute PSP instructions idempotently", and the Board B integrations list is L6, L7, L09B, L11, L13, P1/P2. The L12 → P9 idempotent-command relationship asserted elsewhere in the set is therefore not stated in this poster and has not been written in.
- The poster does not state that other layers may not edit the ledger. It states only "Never direct-edit balances", "No direct DB edits", "Editable balances/history" under DOES NOT OWN, and "FinanceOps cannot rewrite physical truth or ledger history". The instruction-sending layers (L6/L7/L09B/L11/L13) appear only as inputs and integrations; their non-edit constraint is implied by the set, not asserted by this poster.
- Board B section 9 (INTEGRATIONS / CALLBACKS) and section 12 (SPECIAL CONTROL — FINAL SETTLEMENT TRUTH) have no home in the mandated section list. To avoid dropping poster content, the integrations list became flow step 11, the customer-charge and provider-payable compositions were merged into flow steps 2 and 3, and the Doneeo/partner share plus ledger & reconciliation statements became invariants. If the format prefers those verbatim as separate sections, they should be relocated.
- Casing variance: OWNS uses "Provider payable" while KEY OUTPUTS and the data objects use "ProviderPayable"; the CamelCase form was used as the artifact name (more frequent, and matches the ProviderPayable.Created event).
- "Outcome SettlementInput" (KEY INPUTS) versus the consumed event "SettlementInput.Ready" — assumed the same artifact, named SettlementInput.
- "Refund/ReleaseInstruction" appears once as a single output name and may be two artifacts (RefundInstruction, ReleaseInstruction); left exactly as printed.
- "TaxDecision refs" is an input and "Tax settlement references" is owned, but no tax artifact appears in the data-object or event lists.
- Board A flow steps are unnumbered prose fragments on the poster; the trailing periods added here are formatting only.
