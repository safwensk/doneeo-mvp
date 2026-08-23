# P9 — Payment Rails, Tax/Financial Adapters & Treasury Integrations Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Execute controlled external financial rail operations for PSPs, banks, payouts, tax and FX under instructions from authoritative commercial/settlement layers.

## Owns
- Payment-method token/reference boundary
- PSP authorization/capture/refund/void adapter calls
- Payout/bank transfer rails
- Tax-provider/remittance adapters
- FX/provider adapters
- Financial webhook normalization
- Rail-level retries/idempotency/status

## Explicitly does not own
- Pricing/fees/customer offer (L6)
- Final settlement allocation/customer charge/provider payable (L12/09B)
- Authoritative ledger/reconciliation (L12)
- Fraud/security policy (P4)
- Generic connector framework (P5)

## Inputs
- PaymentTopologyPolicy/ContractRoleProfile refs
- Idempotent FinancialCommand from L12
- P3 payer/payee identity refs
- P4 fraud/security clearance
- P5 connector transport primitives

## Authoritative outputs
- FinancialRailResult
- AuthorizationRef
- CaptureRef
- RefundRef
- PayoutRef
- TaxRailResult
- FXQuoteRef
- NormalizedFinancialWebhook

## Engines / components
- PSP Adapter Gateway
- Payment Method Token Service
- Authorization/Capture Adapter
- Refund/Void Adapter
- Payout/Bank Adapter
- Tax/Remittance Adapter
- FX Adapter
- Webhook Normalizer
- Rail Retry/Idempotency Controller

## Main decision / operating path
1. Receive signed/idempotent command from L12.
2. Resolve PaymentTopologyPolicy adapter path without changing business allocation.
3. Execute PSP/bank/tax/FX operation.
4. Normalize callback/webhook and correlate to command.
5. Return rail result/status to L12.
6. L12 posts ledger and performs authoritative reconciliation.
7. P4 handles fraud/security signals; P8 handles privacy/compliance requirements; P5 provides generic external-connector patterns.

## Gates
- Command authorized/idempotent?
- Adapter/rail available?
- Token/reference valid?
- External result conclusive?
- Retry safe?

## Data objects
- FinancialCommand
- FinancialRailResult
- PaymentMethodTokenRef
- PSPWebhook
- BankTransferRef
- TaxRemittanceRef
- FXQuoteRef

## Events emitted
- Rail.CommandAccepted
- Rail.ResultReceived
- Rail.CallbackNormalized
- Rail.Failed

## Events consumed
- Settlement.FinancialCommand
- PSPWebhookReceived
- BankCallbackReceived

## Failure / recovery
- Timeout → query/retry with idempotency.
- Unknown callback → quarantine/manual review.
- Provider outage → alternate rail only if PaymentTopologyPolicy permits.
- Never infer success from timeout.

## Human review
- High-value manual transfer
- Unknown external status
- Compliance/rail exception

## Security / privacy
- Tokenize/minimize PCI data
- No raw credentials in domain stores
- Secrets vault
- Signed webhooks

## 1M-job scalability
- Adapter workers horizontally scalable
- Per-rail bulkheads
- Circuit breakers/rate limits

## Non-negotiable invariants
- L6 owns price; P9 does not.
- 09B owns responsibility allocation; P9 does not.
- L12 owns final settlement, ledger and reconciliation; P9 only executes external rail commands and returns evidence.
- P5 owns generic connector framework; P9 owns financial-domain adapter semantics.

## Supersedes / preserves
Supersedes P9 v1.0 sections that claim pricing/fees or final settlement/reconciliation authority. Preserves payment/payout/tax/FX rail mechanics.
