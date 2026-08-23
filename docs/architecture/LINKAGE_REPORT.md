# Doneeo architecture — linkage report

**Date:** 2026-08-23
**Method:** all 41 poster SVGs text-extracted, 10 missing layer specs authored from
poster Board A + Board B, then the full 21-spec set checked mechanically. Every
number here is produced by a script over the specs, not by reading.

---

## What was done

| | Before | After |
|---|---|---|
| Layers with a canonical spec | 11 | **21** |
| Specs carrying `Integrations / callbacks` | 0 | **18** |
| Golden regression scenarios in the canon | 0 | **57** |
| Scenarios executable in the repo | 0 | **57** (5 asserting, 52 todo) |

The ten authored specs are L1, L2, L3, L4, L5, L6, L10, L12, P1, P3 — every layer
that had a poster but no reconciled spec. P5 and P7 remain outstanding: they exist
only as PNG in the figma folder, with no SVG to extract.

---

## Finding 1 — the event graph does not connect

This is the substance of "the layers are not linked", and it is now measured.

```
73 events declared as consumed
52 of them have no producer anywhere in the set        (71%)

111 events declared as emitted
92 of them have no declared consumer                    (83%)
```

Splitting the 52 by cause:

**26 are naming drift** — a producer exists under a different event name. These
are cheap to close and each one is a decision about which name wins:

| consumed | nearest producer | |
|---|---|---|
| `CommercialOffer.Selected` (L7) | `CommercialOffer.Created` (L6) | offer created ≠ offer selected; **a real missing event** |
| `RecoveryDecision.Approved` (L10, L11) | `RecoveryOption.Selected` (L09A) | L09A owns `RecoveryDecision` but never emits it |
| `RealityCase.Unrecoverable` (L7) | `RealityCase.Created` (L09A) | the cancellation trigger has no producer |
| `Settlement.FinancialCommand` (P9) | `Settlement.Calculated` (L12) | the L12→P9 rail command is unemitted |
| `RequirementContract.Updated` (L10, L11) | `RequirementContract.Compiled` (L2) | supersession emits nothing |
| `Provider.Declined` (L7) | `Provider.Accepted` (L7) | decline is consumed by the layer that should emit it |

**26 are real holes** — nothing produces them at all. About half are legitimate
system-boundary inputs and should be labelled as such rather than fixed:

- *External, expected:* `Customer.MessageReceived`, `Customer.Acknowledged`,
  `Customer.Complaint`, `Customer.FieldUpdate`, `Customer.AnsweredQuestion`,
  `PSP.CallbackReceived`, `Bank.SettlementReceived`, `Telemetry.Anomaly`,
  `Message.AbuseReport`, `Incident.Reported`, `Credential.Updated`,
  `ProviderProfile.Updated`, `ResourceAvailability.Changed`,
  `Integration.ContractUpdated`
- *Internal, genuinely broken:* `Domain.OutboxReady` (P6 consumes it; P2 must
  emit it — and there is no outbox in the code either), `Identity.Event` and
  `Identity.ContextResolved` and `Recipient.Linked` (P3 emits none of them),
  `ProviderCandidate.Proposed` (L4), `PriorWorkCase.Linked` (L1),
  `Data.ProcessingRegistered` (P2), `Reality.NewFact` and `SafetySignal.Raised`,
  `CommercialDelta.Priced` (L6 owes this to L09B), `L3.SafetyHold` — which is
  also malformed, using a layer id where every other event uses a domain noun.

---

## Finding 2 — ownership is clean; one collision

Across 21 specs and 150+ ownership claims:

```
same item 'owned' by two layers                → none
same item as an authoritative output by two    → DecisionTrace  (L2, L3, P2)
```

Atlas's `Owns` / `Explicitly does not own` device works. It is the correct
anti-duplication mechanism and it holds under mechanical test — the duplication
that was suspected across the whole architecture is, in fact, one artifact.

`DecisionTrace` needs a ruling: P2's own invariant says *"DecisionTrace is
first-class"* and P2 owns it, yet L2 and L3 both list it as an authoritative
output. Most likely L2/L3 *produce entries* and P2 *is the authority*, but the
specs do not say that, and three authorities for one artifact is exactly how
drift starts.

---

## Finding 3 — fourteen artifacts have two spellings each

```
Requirement Contract  /  RequirementContract
Scope Contract        /  ScopeContract
Fact Ledger           /  FactLedger
Completion Specification / CompletionSpecification
Execution Journal     /  ExecutionJournal
Execution Ready       /  ExecutionReady
Provider Protected Payable / ProtectedProviderPayable
Customer Reality Adjustment / CustomerRealityAdjustment
Doneeo Absorption     /  DoneeoAbsorption
Recovery Credit       /  RecoveryCredit
Architecture Simulation / ArchitectureSimulation
Fulfillment Simulation  / FulfillmentSimulation
Fulfillment Cost Snapshot / FulfillmentCostSnapshot
Commercial Offer      /  CommercialOffer
```

Every one is invisible to a human reading 21 documents and obvious to a script.
This is the mechanism by which L9 became three contradictory posters.

Note `ProviderProtectedPayable` vs `ProtectedProviderPayable`: the **posters**
contain both, transposed. v2.1 standardised on one. That drift predates the
reconciliation and Atlas fixed it.

---

## Finding 4 — the platform layers were renumbered mid-project

In the v1.2 posters, **P4 is Event/AI/Observability**. In v2.1, **P4 is Platform
Security** and event transport moved to **P6**. Nothing in either document set
records the change.

P1's own poster consumes from "P4 Event backbone" — correct in v1.2, wrong now.
Any reader holding one document and citing "P4" means something different from a
reader holding the other. Given two documents were already numbered 13 on this
project, this should be closed explicitly rather than left to context.

---

## Finding 5 — the 57 scenarios are back, and one of them fails

Recovered verbatim into `tests/architecture-scenarios.test.ts`, backed by
`tests/architecture-scenarios.json`. Current state: **165 tests, 112 passing,
0 failing, 53 todo.**

Five assert against real code. The one that matters:

> **P1-G1 · Duplicate payment command no duplicate capture**

Three separate boards assert this property — P1-G1, L12-G3 *"Lost callback replay
causes no duplicate financial effect"*, P6-G3 *"Lost callback replay remains
idempotent"* — and P6's spec raises it to a coherence invariant. The generic
property is testable today and **it does not hold**: replaying a command chain
under one idempotency key raises `idempotency key reused with different WorkCase
input` instead of replaying, because `replay()` returns the WorkCase's *current*
state while the next command hashes the `expectedVersion` it was issued against.

The test is written to pass while the defect exists and to fail the moment it is
fixed, with instructions to replace it at that point.

**The test that would have caught this bug was written a week before the bug.**
It was in the posters. The reconciliation deleted it.

---

## Recommended order

1. **Rule on the 26 renames.** Mechanical, one decision each, closes half the
   broken seams.
2. **Emit the 10 internal holes.** Each is a layer failing to publish something
   another layer is already waiting for. `Domain.OutboxReady` first — it is the
   only one that is also missing from the running code.
3. **Rule on `DecisionTrace`** — one owner, others produce entries.
4. **Normalise the 14 name pairs**, then add the check to CI so it cannot recur.
5. **Pin the P4/P6 renumbering** in a note both document sets point at.
6. **Fix the chained-retry defect**, then invert P1-G1 to a positive assertion.

Items 1–4 are the answer to "the layers are not linked". None require an
architectural decision beyond choosing a name.
