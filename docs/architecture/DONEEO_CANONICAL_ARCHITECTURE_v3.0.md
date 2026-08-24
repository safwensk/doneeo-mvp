# Doneeo — Unified Canonical Architecture

**Edition:** v3.0 · clean · 2026-08-23
**Supersedes:** the v1.2 poster set, the v2.1 reconciled specs, and every earlier
layer poster. Where this document and any earlier artifact disagree, this
document is correct — it is the only one whose cross-references have been
checked mechanically rather than by reading.

**Scope:** all 23 layers, at poster-level detail, with the numbering,
naming and event-linkage conflicts resolved. Nothing here is invented: every
line traces to a poster, a board or a reconciled spec. The seven questions no
source answers are listed as open rulings rather than guessed at.

---

## How to use this document

Read §1 and §2 first. They are the rulings that make every other reference in
the file resolvable — without them the layer sections read the way the old set
did, where the same number meant three things.

§5 is the event catalog. It is the coherence test: every consumed event has
exactly one producer, or is declared as arriving from outside Doneeo. If you add
a layer or an event, add it there, and the check in §5 will tell you whether the
graph still closes.

§8 is the layer detail. §9 is the 57 regression scenarios, which are also
executable at `tests/architecture-scenarios.test.ts`.

---

## 0 · What changed

| | |
|---|---|
| Layers specced | **23 of 23** (was 11 of 23) |
| Numbering schemes reconciled to one | **6 → 1** |
| Cross-reference rewrites applied | **21** |
| Artifact-name normalisations | **31** |
| Consumed events corrected to their producer | **15** |
| Missing emissions granted to their owner | **26** |
| Boundary events declared as external | **14** |
| Events still without a producer | **0** |
| Artifacts owned by two layers | **0** |
| Open rulings carried, not guessed | **7** |

Recovered content that no reconciled spec carried: the four SPECIAL CONTROL
panels (L7's commitment ladder and cancellation sequence, L09B's cause taxonomy,
L09A's R0–R5 action table and ten-step recovery hierarchy, L12's settlement
truth), L11's nine-state outcome machine, P1's orchestration principles, and all
57 golden regression scenarios.

---

## 1 · Numbering — the ruling

Canon is **L1–L13 for domain layers** and **P1–P9 for platform layers**. There is
no L9: reality decisions are **L09A**, economics are **L09B**. There is no P10 —
it was generation drift and its mechanics belong to L8 and L10. There is no
Layer 14.

Every reference below was rewritten in place. The originals are recorded here so
an older document can still be read against this one.

| written as | in | means |
|---|---|---|
| `Layer 14 (Data & Intelligence)` | scheme F | **L2 (Intelligence & Planning)** |
| `Layer 14 (Intelligence)` | scheme B | **L2 (Intelligence & Planning)** |
| `P14 Intelligence` | scheme A | **L2 (Intelligence & Planning)** |
| `Layer 06 (Planning)` | scheme B: NOT L6 | **L2 (Intelligence & Planning)** |
| `Layer 06 (Customer Interface)` | scheme F | **L2 customer surface (see open ruling OR-3)** |
| `Layer 07 (Executor Interface)` | scheme F | **L8/L10 executor surface (see open ruling OR-3)** |
| `Layer 08 (Execution & Monitoring)` | scheme F | **L10 (Live Execution & Change Control)** |
| `Layer 05 (Fulfillment & Routing)` | scheme F | **L4 (Fulfillment, Matching & Team Assembly)** |
| `Layer 04 (Matching & Teams)` | scheme F | **L4 (Fulfillment, Matching & Team Assembly)** |
| `Layer 10 (Execution)` | scheme B | **L10 (Live Execution & Change Control)** |
| `Layer 11 (Outcome…)` | — | **L11 (Outcome, Completion & Evidence)** |
| `Layer 12 (Settlement…)` | — | **L12 (Settlement, Ledger & Reconciliation)** |
| `Layer 13 (Disputes)` | scheme B | **L13 (Branch, Continuity, Claims & Support)** |
| `Layer 13 (Claims & Disputes)` | scheme F | **L13 (Branch, Continuity, Claims & Support)** |
| `P12 Settlement` | scheme A | **L12 (Settlement, Ledger & Reconciliation)** |
| `P13 Claims` | scheme A | **L13 (Branch, Continuity, Claims & Support)** |
| `P10 Execution` | scheme A; P10 discarded as drift | **L10 (Live Execution & Change Control)** |
| `P10 (Execution)` | scheme C | **L10 (Live Execution & Change Control)** |
| `P6 Providers` | scheme A; see open ruling OR-2 | **L4 (Fulfillment, Matching & Team Assembly)** |
| `P8 Task Safety` | scheme A; see open ruling OR-2 | **L3 (Trust, Safety, Rules & Compliance)** |
| `P9 Messaging` | scheme A | **P7 (Notifications, Messaging & User Engagement)** |
| `P9 (Finance)` | scheme C | **L12 for settlement truth, P9 for rails only** |
| `P4 (Event, AI, Obs.)` | scheme D | **P6 (Event Backbone, Model Gateway & Observability)** |
| `P4 Event backbone` | scheme D | **P6 (Event Backbone, Model Gateway & Observability)** |
| `Layer 01 (WorkCase & Intake)` | scheme F | **L1 (Intake, Context & WorkCase)** |
| `Layer 02 (Intelligence & Planning)` | scheme F | **L2 (Intelligence & Planning)** |
| `Layer 03 (Trust & Safety)` | scheme F | **L3 (Trust, Safety, Rules & Compliance)** |
| `Layer 09A…)?` | scheme F | **L09A (Reality & Recovery Decision)** |
| `Layer 09B…)?` | scheme F | **L09B (Responsibility & Fairness Economic)** |
| `Layers 06–10` | scheme B | **the domain layers L2-L11** |
| `Layers 11–12` | scheme B | **L12 (Settlement, Ledger & Reconciliation)** |
| `Layers 01–10` | scheme C | **the domain layers L1-L11** |
| `Layers 02–03` | scheme C | **P2 (Data & Fact Ledger) and P3 (Identity)** |

### The `P1`–`P15` collision inside L2

L2's planning engine numbers its own phases **P1 through P15** — `P4 Fact
Resolver`, `P9 Abstract Resource Planner`, `P15 Requirement Compiler`. That
namespace overlaps the platform layers exactly.

So a bare `P4` has three readings: Platform Security (canon), Event/AI &
Observability (scheme D), or L2's Fact Resolver. `P9` has three of its own.
This is the worst of the collisions because it lives inside the most-referenced
layer and uses an identical token.

L2 already carries an unambiguous parallel numbering — `E1`–`E15` — on the same
lines. **Ruling: inside L2, phases are `E1`–`E15`. The `P` form is dropped.**
`P1`–`P9` mean platform layers everywhere, without exception.


**The trap worth naming:** `Layer 06` meant Customer Interface on one board,
Planning on another, and Commercial Offer & Pricing in canon. Remapping it by
number lands on the pricing layer, and nothing announces the error.

---

## 2 · Artifact names — the ruling

One spelling per artifact. 15 families had two.

| was | is |
|---|---|
| `Architecture Simulation` | **`ArchitectureSimulation`** |
| `Commercial Offer` | **`CommercialOffer`** |
| `Completion Specification` | **`CompletionSpecification`** |
| `Customer Reality Adjustment` | **`CustomerRealityAdjustment`** |
| `Doneeo Absorption` | **`DoneeoAbsorption`** |
| `Execution Journal` | **`ExecutionJournal`** |
| `Execution Ready` | **`ExecutionReady`** |
| `Fact Ledger` | **`FactLedger`** |
| `Fulfillment Cost Snapshot` | **`FulfillmentCostSnapshot`** |
| `Fulfillment Simulation` | **`FulfillmentSimulation`** |
| `Provider Protected Payable` | **`ProtectedProviderPayable`** |
| `ProviderProtectedPayable` | **`ProtectedProviderPayable`** |
| `Recovery Credit` | **`RecoveryCredit`** |
| `Requirement Contract` | **`RequirementContract`** |
| `Scope Contract` | **`ScopeContract`** |

---

## 3 · End-to-end continuity

1.  **L1** opens the WorkCase and captures the request, context and evidence as immutable source truth.
2.  **L2** interprets it, resolves facts and MSI, architects the TaskGraph, abstract resources and CompletionSpecification, and compiles the `RequirementContract` — provider-neutral.
3.  **L3 (T1)** classifies rules, risks and required qualifications during planning.
4.  **L4** retrieves real candidates, applies **L3 (T2)** hard eligibility and assembles the team.
5.  **L5** closes true resource and logistics gaps into a reservable plan.
6.  **L4** builds schedule and route, runs FulfillmentSimulation, and ranks only feasible options.
7.  **L6** prices the feasible options and issues the `ScopeContract` and `CommercialOffer`.
8.  **L7** records commitment, provider acceptance and `CapacityReservation`s; owns reschedule and cancellation from here on.
9.  **L8** compiles the mission, revalidates **L3 (T3)** credentials, site and access, and dispatches only at `ExecutionReady`.
10. Arrival, or any material field mismatch, invokes **L09A**. Unaffected TaskBlocks continue.
11. **L09A** opens a `RealityCase`, classifies R0–R5 semantically, isolates impact and selects the fastest safe recovery.
12. **L09A** may call **L2** for targeted reanalysis of affected nodes only, **L3** for reclassification, **L4/L5** for resource recovery, **L7** for reschedule or cancellation, **L13** for a branch.
13. **L09B** is invoked only when economic allocation is contested. **L7 capacity recovery runs first** — net lost capacity cannot be measured before backfill is attempted.
14. **L10** executes approved TaskBlocks and keeps the append-only `ExecutionJournal`; material change always routes through L09A.
15. **L10** submits the completion package. "Done" is a submission signal, nothing more.
16. **L11** verifies evidence against the `CompletionSpecification` and the approved contract version, and decides completion per TaskBlock and per JobOrder.
17. Normal completion flows **L11 → L12**. Fairness flows **L11/L09A → L09B → L12**. Disputes flow **L11 → L13**. New physical facts return to **L09A**.
18. **L12** computes customer charge and provider payable independently, executes through **P9** rails, and posts the append-only balanced ledger.
19. **L13** carries WorkCase continuity and claims without rewriting L11 outcome truth or L12 ledger truth.
20. **P1** coordinates every transition; **P2** records facts, evidence and DecisionTrace; **P3–P9** provide identity, security, integration, event transport, messaging, privacy and financial rails.

---

## 4 · Ownership

No artifact is owned by two layers. Each layer's `Owns` and `Explicitly does not
own` sections in §8 are the authority; the disclaimers point at the owner, and
every owner now exists.

---

## 5 · Event catalog

**136 events emitted · 66 consumed · 0 without a producer.**

Before the rulings, 52 of 73 consumed events had no producer at all. Every
correction is recorded in §0 and visible inline in §8, marked
*(added by ruling: …)*.

### Events and their consumers

| event | emitted by | consumed by |
|---|---|---|
| `Abuse.CaseOpened` | P4 | *(no declared consumer)* |
| `Access.Denied` | P3 | *(no declared consumer)* |
| `AdjustmentInstruction.Approved` | L09B | *(no declared consumer)* |
| `ArchitectureSimulation.Completed` | L2 | *(no declared consumer)* |
| `Artifact.Versioned` | P2 | *(no declared consumer)* |
| `Availability.Confirmed` | L4 | *(no declared consumer)* |
| `Branch.BlockedParent` | L13 | *(no declared consumer)* |
| `Branch.Completed` | L13 | *(no declared consumer)* |
| `Branch.Created` | L13 | *(no declared consumer)* |
| `Branch.Requested` | L09A | L13 |
| `Cancellation.Reconciled` | L7 | L12 |
| `Cancellation.Requested` | L7 | L09B, L5, L8 |
| `CandidateSet.Retrieved` | L4 | *(no declared consumer)* |
| `Capacity.Held` | L7 | *(no declared consumer)* |
| `CapacityRecovery.Completed` | L7 | L09B |
| `Claim.Opened` | L13 | P3 |
| `Claim.Resolved` | L13 | *(no declared consumer)* |
| `Command.RejectedStaleVersion` | P1 | *(no declared consumer)* |
| `CommercialDelta.Priced` | L6 | L09B |
| `CommercialOffer.Created` | L6 | *(no declared consumer)* |
| `CommercialOffer.Expired` | L6 | *(no declared consumer)* |
| `CommercialOffer.Selected` | L6 | L7 |
| `Commitment.Hardened` | L7 | *(no declared consumer)* |
| `Completion.Submitted` | L10 | L11 |
| `Compliance.FindingRaised` | P8 | *(no declared consumer)* |
| `Consent.ContextUpdated` | P3 | P8 |
| `Consent.Granted` | P3 | *(no declared consumer)* |
| `Consent.Revoked` | P3 | *(no declared consumer)* |
| `Context.Updated` | L1 | L8 |
| `CustomerAdjustment.Calculated` | L09B | *(no declared consumer)* |
| `DLQ.ItemCreated` | P6 | *(no declared consumer)* |
| `DSR.Opened` | P8 | *(no declared consumer)* |
| `Data.ProcessingRegistered` | P2 | P8 |
| `DecisionTrace.Created` | P2 | *(no declared consumer)* |
| `Dispatch.Ready` | L8 | L10 |
| `Dispute.Decided` | L13 | *(no declared consumer)* |
| `Domain.OutboxReady` | P2 | P6 |
| `Eligibility.Blocked` | L3 | *(no declared consumer)* |
| `Eligibility.PassWithControls` | L3 | *(no declared consumer)* |
| `Eligibility.Passed` | L3 | *(no declared consumer)* |
| `Event.Delivered` | P6 | *(no declared consumer)* |
| `Evidence.Uploaded` | L1 | L2 |
| `Execution.IssueDetected` | L10 | L09A |
| `Execution.ResumeRequested` | L09A | *(no declared consumer)* |
| `Execution.Started` | L10 | L7 |
| `Fact.Appended` | P2 | *(no declared consumer)* |
| `FactLedger.FieldUpdated` | L09A | L2 |
| `FactLedger.Updated` | L2 | *(no declared consumer)* |
| `FinanceException.Opened` | L12 | *(no declared consumer)* |
| `Fraud.SignalRaised` | P4 | *(no declared consumer)* |
| `Fulfillment.Failed` | L4 | *(no declared consumer)* |
| `Fulfillment.TeamSelected` | L4 | L5 |
| `FulfillmentOption.Generated` | L4 | L6 |
| `FulfillmentSimulation.Passed` | L4 | *(no declared consumer)* |
| `Handoff.Completed` | L10 | *(no declared consumer)* |
| `Identity.ContextResolved` | P3 | L1 |
| `Identity.Event` | P3 | P4 |
| `Issue.Detected` | L10 | *(no declared consumer)* |
| `Ledger.Posted` | L12 | *(no declared consumer)* |
| `MSI.Updated` | L2 | *(no declared consumer)* |
| `Milestone.Reached` | L10 | *(no declared consumer)* |
| `ModelInvocation.Completed` | P6 | *(no declared consumer)* |
| `Operational.AlertRaised` | P6 | *(no declared consumer)* |
| `Outcome.ActualsAvailable` | L11 | L09B |
| `Outcome.Disputed` | L11 | *(no declared consumer)* |
| `Outcome.JobOrderCompletionEligible` | L11 | *(no declared consumer)* |
| `Outcome.RemediationRequired` | L11 | L13 |
| `Outcome.TaskBlockVerified` | L11 | *(no declared consumer)* |
| `Payment.AuthorizationUpdated` | L12 | L7, P4 |
| `Payment.Captured` | L12 | *(no declared consumer)* |
| `Payment.Disputed` | L12 | L13 |
| `Planning.NeedsHumanReview` | L2 | *(no declared consumer)* |
| `Preflight.Blocked` | L8 | *(no declared consumer)* |
| `Preflight.Passed` | L8 | *(no declared consumer)* |
| `Preflight.Started` | L8 | L3, L5 |
| `PriceOption.Selected` | L6 | *(no declared consumer)* |
| `PriorWorkCase.Linked` | L1 | L1 |
| `Privacy.PolicyUpdated` | P8 | *(no declared consumer)* |
| `Projection.Updated` | P2 | *(no declared consumer)* |
| `Promotion.Updated` | L6 | L6 |
| `Provider.Accepted` | L7 | L3, L8, P3 |
| `Provider.Declined` | L4 | L7 |
| `Provider.EnRoute` | L8 | *(no declared consumer)* |
| `Provider.FieldObservation` | L10 | L09A |
| `ProviderCandidate.Proposed` | L4 | L3 |
| `ProviderPayable.Created` | L12 | *(no declared consumer)* |
| `ProviderProtection.Calculated` | L09B | *(no declared consumer)* |
| `Question.Requested` | L2 | *(no declared consumer)* |
| `Rail.CallbackNormalized` | P9 | *(no declared consumer)* |
| `Rail.CommandAccepted` | P9 | *(no declared consumer)* |
| `Rail.Failed` | P9 | *(no declared consumer)* |
| `Rail.ResultReceived` | P9 | *(no declared consumer)* |
| `RealityCase.Created` | L09A | L3, L5 |
| `RealityCase.Requested` | L10 | *(no declared consumer)* |
| `RealityCase.Unrecoverable` | L09A | L7 |
| `Recipient.Linked` | P3 | P3 |
| `RecipientGrant.Issued` | P3 | *(no declared consumer)* |
| `Reconciliation.Completed` | L12 | *(no declared consumer)* |
| `RecoveryCredit.Applied` | L09B | *(no declared consumer)* |
| `RecoveryDecision.Approved` | L09A | L10, L11 |
| `RecoveryOption.Selected` | L09A | L09B |
| `Refund.Issued` | L12 | *(no declared consumer)* |
| `Remedy.Issued` | L13 | *(no declared consumer)* |
| `RequirementContract.Compiled` | L2 | L3, L4, L5 |
| `RequirementContract.Superseded` | L2 | L10, L11 |
| `Reschedule.Proposed` | L7 | L4 |
| `Resource.Collected` | L5 | *(no declared consumer)* |
| `Resource.CostUpdated` | L5 | L6 |
| `Resource.Delivered` | L5 | *(no declared consumer)* |
| `Resource.GapDetected` | L5 | *(no declared consumer)* |
| `Resource.Ready` | L5 | L10 |
| `Resource.ReceiptUploaded` | L5 | *(no declared consumer)* |
| `Resource.Reserved` | L5 | L8 |
| `Responsibility.Assessed` | L09B | L12 |
| `Retention.Actioned` | P8 | *(no declared consumer)* |
| `Review.Requested` | P1 | *(no declared consumer)* |
| `Role.Changed` | P3 | *(no declared consumer)* |
| `Rules.Classified` | L3 | L2, L4 |
| `Rules.Updated` | L3 | L6 |
| `Safety.HoldRaised` | L3 | P4 |
| `SafetyHold.Cleared` | L3 | *(no declared consumer)* |
| `SafetyHold.Placed` | L3 | *(no declared consumer)* |
| `SafetySignal.Raised` | L3 | L09A |
| `Saga.Compensated` | P1 | *(no declared consumer)* |
| `ScopeContract.Created` | L6 | *(no declared consumer)* |
| `Security.ControlApplied` | P4 | *(no declared consumer)* |
| `Security.IncidentOpened` | P4 | P8 |
| `Security.RiskDetected` | P4 | *(no declared consumer)* |
| `Settlement.Calculated` | L12 | *(no declared consumer)* |
| `Settlement.FinancialCommand` | L12 | P9 |
| `SettlementInput.Ready` | L11 | L12 |
| `TargetedReanalysis.Requested` | L09A | *(no declared consumer)* |
| `TaskGraph.Created` | L2 | *(no declared consumer)* |
| `Team.Assembled` | L4 | *(no declared consumer)* |
| `WorkCase.Created` | L1 | L2, P3 |
| `Workflow.Advanced` | P1 | *(no declared consumer)* |

### Boundary events

These arrive from outside Doneeo. They correctly have no internal producer.

| event | origin |
|---|---|
| `Bank.SettlementReceived` | bank, via P9 |
| `Credential.Updated` | provider or issuing authority, via P5 |
| `Customer.Acknowledged` | customer, via P7 |
| `Customer.AnsweredQuestion` | customer, via P7 |
| `Customer.Complaint` | customer, via P7 |
| `Customer.FieldUpdate` | customer, via P7 |
| `Customer.MessageReceived` | customer, via P7 |
| `Incident.Reported` | user or operations |
| `Integration.ContractUpdated` | operations |
| `Message.AbuseReport` | user report, via P7 |
| `PSP.CallbackReceived` | payment service provider, via P9 |
| `ProviderProfile.Updated` | provider |
| `ResourceAvailability.Changed` | partner or supplier, via P5 |
| `Telemetry.Anomaly` | infrastructure, via P6 |

**Every consumed event now has a producer or is declared external.**

84 emitted events have no declared consumer. That is not necessarily
wrong — an event may exist for audit, analytics or a layer not yet built — but
each one is either a missing subscription or dead weight, and the list is in the
table above.

---

## 6 · Global invariants

These hold across every layer. A change that violates one is a change to the
architecture, not to a layer.

- No plan/estimate/match before Layer 2  <sub>L1</sub>
- Original customer input remains immutable source evidence  <sub>L1</sub>
- WorkCase is continuity container; JobOrder is not created here  <sub>L1</sub>
- Plan before supply  <sub>L2</sub>
- Use AI for meaning; code for authority  <sub>L2</sub>
- Ask only material questions; never repeat known facts  <sub>L2</sub>
- Full reanalysis only when affected scope cannot be isolated  <sub>L2</sub>
- Hard legal/safety constraints cannot be outvoted by optimization  <sub>L3</sub>
- Eligibility at offer time does not imply dispatch readiness  <sub>L3</sub>
- Payment never implies safety clearance  <sub>L3</sub>
- RequirementContract is authoritative for hard constraints  <sub>L4</sub>
- Bookable feasibility precedes customer offer  <sub>L4</sub>
- Provider acceptance occurs after customer authorization unless category policy requires otherwise  <sub>L4</sub>
- Check customer -> provider/team -> partner/rental/purchase  <sub>L5</sub>
- Rental pickup/return is not working time unless policy explicitly says otherwise  <sub>L5</sub>
- No arbitrary executor-added resource charge  <sub>L5</sub>
- Customer sees feasible options only  <sub>L6</sub>
- Offer is based on known facts and stated assumptions  <sub>L6</sub>
- Offer price is not final settlement after reality changes  <sub>L6</sub>
- No universal cancellation hours/percentages are canonical.  <sub>L7</sub>
- Cancellation remains requestable.  <sub>L7</sub>
- Voluntary cancellation ≠ Field Reality Block.  <sub>L7</sub>
- ProtectedProviderPayable and customer liability are different quantities.  <sub>L7</sub>
- Net Lost Reserved Capacity = Reserved Capacity − Successfully Reallocated Capacity.  <sub>L7</sub>
- Customer never automatically pays full original price for unperformed work.  <sub>L7</sub>
- Provider acceptance ≠ dispatch readiness.  <sub>L8</sub>
- Payment authorization ≠ dispatch readiness.  <sub>L8</sub>
- L8 ends at ExecutionReady/Dispatch; L10 owns live execution.  <sub>L8</sub>
- Arrival Reality Check is separate from pre-departure preflight.  <sub>L8</sub>
- R0–R5 are semantic classes, NOT severity.  <sub>L09A</sub>
- Physical reality is authoritative but cannot bypass controls.  <sub>L09A</sub>
- Solution before broad replanning.  <sub>L09A</sub>
- Continue unaffected TaskBlocks when dependencies/safety allow.  <sub>L09A</sub>
- Full replan and cancellation are last resort.  <sub>L09A</sub>
- NO weighted blame engine.  <sub>L09B</sub>
- PPP ≠ customer liability ≠ Doneeo absorption.  <sub>L09B</sub>
- Doneeo planning error does not become customer surcharge.  <sub>L09B</sub>
- Hidden condition alone does not create customer liability.  <sub>L09B</sub>
- Customer declining revised work does not make revised job/full original price automatically owed.  <sub>L09B</sub>
- Execution never self-expands scope  <sub>L10</sub>
- Journal append-only  <sub>L10</sub>
- Actuals are evidence, not automatically customer charges  <sub>L10</sub>
- Continue unaffected work where safe  <sub>L10</sub>
- CompletionSpecification is the central success authority.  <sub>L11</sub>
- Customer acceptance is evidence, not sole authority.  <sub>L11</sub>
- Done/Submit ≠ Completed.  <sub>L11</sub>
- Blocked execution is not automatically a terminal outcome.  <sub>L11</sub>
- Cancelled is final only when L7 finalizes cancellation.  <sub>L11</sub>
- JobOrder closure ≠ WorkCase closure.  <sub>L11</sub>
- Actual cost facts are not automatically customer charges.  <sub>L11</sub>
- Payment never implies safe/assigned/ready/completed.  <sub>L12</sub>
- Customer charge ≠ provider payable.  <sub>L12</sub>
- FinanceOps cannot rewrite physical truth or ledger history.  <sub>L12</sub>
- No direct DB edits.  <sub>L12</sub>
- Doneeo/partner share absorbs platform/partner responsibility and Recovery Credits without silently shifting it to customer or executor.  <sub>L12</sub>
- Append-only balanced postings; idempotent PSP commands; transactional inbox/outbox; reconciliation; FinanceOps exceptions; no direct balance edits.  <sub>L12</sub>
- WorkCase may outlive a JobOrder.  <sub>L13</sub>
- Branch types: PREREQUISITE_FOR, FOLLOW_UP_TO, REMEDIATION_FOR, CUSTOMER_ADDED_SCOPE, INCIDENT_RECOVERY, WARRANTY_REWORK.  <sub>L13</sub>
- Independent observed work never becomes current billable scope without consent.  <sub>L13</sub>
- Claims/support consume source truth; they do not rewrite it.  <sub>L13</sub>
- Orchestrator coordinates; domains decide  <sub>P1</sub>
- No God Object  <sub>P1</sub>
- Design for failure  <sub>P1</sub>
- Commands and events are distinct  <sub>P1</sub>
- No giant JobOrder JSON.  <sub>P2</sub>
- FactLedger does not mean all domain tables collapse into one store.  <sub>P2</sub>
- Derived read/search/warehouse never outranks source.  <sub>P2</sub>
- DecisionTrace is first-class.  <sub>P2</sub>
- Validity/expiry is first-class.  <sub>P2</sub>
- P6 owns event transport, not P2.  <sub>P2</sub>
- Third-party recipients see only relevant information unless explicitly granted more  <sub>P3</sub>
- Internal operators use role-scoped access  <sub>P3</sub>
- Advertisers/partners never receive conversation/workcase data outside authorized service purpose  <sub>P3</sub>
- L3 owns job safety/legal/qualification decisions.  <sub>P4</sub>
- P4 owns platform security/fraud/abuse/runtime protection.  <sub>P4</sub>
- P3 owns identity/access.  <sub>P4</sub>
- P8 owns privacy compliance.  <sub>P4</sub>
- Standardized — use open standards and contracts  <sub>P5</sub>
- Observable — monitor, log and trace  <sub>P5</sub>
- Secure by Default — AuthN, AuthZ, encryption  <sub>P5</sub>
- Governed — approved, versioned, audited  <sub>P5</sub>
- Resilient & Reliable — retries, timeouts, fallbacks  <sub>P5</sub>
- Extensible — easy to plug and scale  <sub>P5</sub>
- Loose Coupling — async first, event-driven  <sub>P5</sub>
- Data Quality — validate, map, reconcile  <sub>P5</sub>
- P5 writes immutable integration facts to P2  <sub>P5</sub>
- AI reasons/recommends; deterministic code/rules/state/versioning are authority.  <sub>P6</sub>
- No mandatory multi-model consensus.  <sub>P6</sub>
- Learning may propose, never auto-publish compliance rules.  <sub>P6</sub>
- Scale changes HOW, not WHAT.  <sub>P6</sub>
- Million-job logical architecture now; million-job physical infrastructure when load requires it.  <sub>P6</sub>
- Relevant — context-aware messages  <sub>P7</sub>
- Timely — right time, not too much  <sub>P7</sub>
- Personalized — user, role and context  <sub>P7</sub>
- Actionable — clear call to action  <sub>P7</sub>
- Reliable — deliver or retry  <sub>P7</sub>
- Respectful — user preferences first  <sub>P7</sub>
- Two-Way — listen and respond  <sub>P7</sub>
- Inclusive — accessible and localized  <sub>P7</sub>
- Compliant — legal and policy aligned  <sub>P7</sub>
- Measurable — track and improve  <sub>P7</sub>
- P7 writes communication facts to P2  <sub>P7</sub>
- P3 owns identity/access/consent grants; P8 owns privacy policy and data lifecycle.  <sub>P8</sub>
- P4 owns runtime security enforcement.  <sub>P8</sub>
- P2 owns authoritative data/evidence stores.  <sub>P8</sub>
- Privacy controls apply across all domain layers.  <sub>P8</sub>
- L6 owns price; P9 does not.  <sub>P9</sub>
- 09B owns responsibility allocation; P9 does not.  <sub>P9</sub>
- L12 owns final settlement, ledger and reconciliation; P9 only executes external rail commands and returns evidence.  <sub>P9</sub>
- P5 owns generic connector framework; P9 owns financial-domain adapter semantics.  <sub>P9</sub>

---

## 7 · Open rulings

Seven questions no source answers. They are **not decided here**. Deciding them
by inference is how the drift started.

### OR-1 — Who classifies R3 vs R5?

R3 changes the job's scope; R5 must not be billed without consent. The difference decides whether the customer pays. L09A names a 'Semantic R0-R5 Classifier' and never says whether it is deterministic, model-advised or human. P6 requires deterministic authority for anything binding, and L09A's human-review list covers R4 but not the R3/R5 boundary. This is the most economically consequential unowned decision in the architecture.

### OR-2 — Are Providers and Task Safety platform or domain concerns?

One board files them as platform layers; canon makes them domain layers L4 and L3. That is a genuine difference of opinion about what is cross-cutting, not a naming slip. Mapped to L4/L3 in this document so references resolve, but the underlying question is untouched.

### OR-3 — Do Customer Interface and Executor Interface exist as layers?

The original twenty-document stack had both. Canon has neither; their responsibilities are implied inside L2, L8 and L10 without being named. References are mapped so nothing dangles, but a surface that no layer owns is how the frontend ends up owning progression, which anti-pattern 8 forbids.

### OR-4 — What happens when an executor refuses?

Canon covers the executor being unable - credential lapse, resource failure, physical impossibility. It does not cover an executor who arrives, judges the site unsafe and declines, where L3 later disagrees. It is neither a fact nor blame, so 'executor submits facts, not blame' does not route it. Capacity was reserved and mobilisation happened, so it has real economic consequence and no owner.

### OR-5 — What bounds DoneeoAbsorption?

When Doneeo's planning is wrong, ProtectedProviderPayable must still be paid and the customer must not be surcharged. Correct, and unbounded: no cap, no alert threshold, and no path from absorption events back into L2 planning quality. The exposure is set by how good the planner is and nothing measures it.

### OR-6 — How long may an outcome wait on customer acknowledgement?

L11 says non-response cannot leave a job open indefinitely when objective evidence suffices, but names no bound. The same reasoning that removed fixed cancellation windows from L7 leaves this window undefined too. Either both are configurable policy - say so - or the asymmetry needs a reason.

### OR-7 — One authority for DecisionTrace.

P2 owns it and its invariant calls it first-class, yet L2 and L3 both list it as an authoritative output. Most likely L2/L3 produce entries and P2 is the authority. Written that way below; confirm or correct.

---

## 8 · The layers


---

## L1 — Intake, Context & WorkCase

### Purpose

Capture the customer's messy real-world problem, context and initial evidence in a durable WorkCase without prematurely estimating, matching or deciding execution.

### Owns

- WorkCase creation and identity
- Original request and normalized intake
- Customer goal / desired outcome
- Context capture: location, timing, access, recipients
- Initial evidence and attachment references
- Continuity link to future JobOrders/branches

### Explicitly does not own

- Task architecture or RequirementContract
- Provider selection or availability
- Safety/legal final decisions
- Pricing or payment
- Execution control
- Outcome verification

### Inputs

- Customer text/voice/photo/file input
- Account/identity context
- Known locations and timing
- Prior WorkCase context if explicitly linked
- Recipient/access details when provided

### Authoritative outputs

- WorkCase
- NormalizedRequest
- Initial FactLedger entries
- Evidence references
- Customer objective
- Context snapshot
- PlanningStarted command

### Engines / components

- Input Normalizer
- Context Capture Engine
- Evidence Intake Engine
- WorkCase Manager
- Objective Resolver
- Recipient/Access Context Resolver

### Main decision / operating path

1. Receive I Need Help request
2. Create WorkCase ID
3. Normalize content and channels
4. Capture stated facts and evidence
5. Resolve customer objective
6. Record context and provenance
7. Hand off to Layer 2 Intelligence

### Gates

- WorkCase identity valid?
- Customer consent/access valid?
- Enough input to begin semantic interpretation?

### Data objects

- WorkCase
- NormalizedRequest
- ContextSnapshot
- EvidenceRef
- CustomerObjective
- RecipientContext

### Events emitted

- WorkCase.Created
- Evidence.Uploaded
- Context.Updated
- PlanningRequested
- PriorWorkCase.Linked  *(added by ruling: L1 owns WorkCase identity and continuity)*

### Events consumed

- Customer.MessageReceived  *(external: customer, via P7)*
- Identity.ContextResolved
- PriorWorkCase.Linked

### Failure / recovery

- Duplicate request -> idempotent reuse/new version
- Attachment unavailable -> preserve reference and request retry
- Conflicting locations/times -> record conflict for Layer 2
- Partial input -> create WorkCase anyway; planning determines MSI

### Human review

- Identity ambiguity
- Third-party recipient authority ambiguity
- Conflicting customer ownership/authorization

### Security / privacy

- Minimize collected data
- Evidence access scoped to WorkCase roles
- Explicit consent for third-party recipient sharing
- Encryption in transit/at rest

### 1M-job scalability

- Stateless intake workers
- WorkCase-partitioned writes
- Object storage for media
- Async enrichment allowed; customer acknowledgment remains low latency

### Non-negotiable invariants

- No plan/estimate/match before Layer 2
- Original customer input remains immutable source evidence
- WorkCase is continuity container; JobOrder is not created here

### Integrations / callbacks

- P3 Identity/Consent
- P2 FactLedger/Evidence
- L2 Intelligence
- P1 Orchestrator

### Golden regression scenarios

- Multi-part request preserved as one WorkCase
- Third-party recipient captured without over-sharing
- Duplicate submit does not duplicate WorkCase


---

## L2 — Intelligence & Planning

### Purpose

Transform a messy physical-work problem into a complete, versioned RequirementContract based on facts, minimal sufficient information, explicit assumptions and measurable completion criteria.

### Owns

- Problem understanding
- Task decomposition
- Global pre-analysis
- Fact resolution
- MSI and question strategy
- TaskGraph architecture
- Abstract resource planning
- Time/route/cost estimation
- CompletionSpecification
- Architecture simulation
- RequirementContract compilation

### Explicitly does not own

- Provider matching/availability
- Commercial offer/pricing
- Final rule authority
- Payment/settlement
- Execution truth/outcome

### Inputs

- WorkCase and objective
- FactLedger/evidence
- Context/location/timing/access
- Rules metadata
- Service/task primitive library
- Historical calibration data

### Authoritative outputs

- TaskBlocks
- TaskGraph
- MSI state
- QuestionPlan
- AbstractResourcePlan
- Estimates
- ScenarioSet
- CompletionSpecification
- RequirementContract vN
- DecisionTrace

### Engines / components

- E1 Semantic Interpreter
- E2 Candidate Task Decomposer
- E3 Global Pre-analysis
- E4 Fact Resolver
- E5 Primitive & Task Architect
- E6 Dependency / TaskGraph Engine
- E7 MSI / Gap / Evidence Resolver
- E8 Question Orchestrator
- E9 Abstract Resource Planner
- E10 Time / Route / Cost Estimator
- E11 CompletionSpecification Engine
- E12 Scenario / Constraint Optimizer
- E13 Architecture Simulator
- E14 Risk-Based Quality Checker
- E15 Requirement Compiler

### Main decision / operating path

1. Semantic interpretation
2. Candidate task decomposition
3. Global pre-analysis for shared facts/dependencies
4. Fact resolution to authoritative FactLedger
5. MSI check
6. Ask only targeted missing questions; deterministic per-answer update loop
7. Build TaskGraph and primitives
8. Plan abstract resources
9. Estimate time/route/cost
10. Define completion specification
11. Generate scenarios
12. Architecture simulation
13. Risk-based quality challenge
14. Compile RequirementContract vN

### Gates

- MSI cleared or explicit assumption accepted?
- Architecture feasible independent of supply?
- Hard constraints satisfied?
- Risk requires independent checker/human?
- RequirementContract internally consistent?

### Data objects

- FactLedger
- TaskBlock
- TaskGraph
- MSIItem
- QuestionPlan
- AbstractResourceNeed
- Estimate
- Scenario
- CompletionSpecification
- RequirementContract
- DecisionTrace

### Events emitted

- FactLedger.Updated
- MSI.Updated
- Question.Requested
- TaskGraph.Created
- ArchitectureSimulation.Completed
- RequirementContract.Compiled
- Planning.NeedsHumanReview
- RequirementContract.Superseded  *(added by ruling: supersession emitted nothing; only initial compile did)*

### Events consumed

- WorkCase.Created
- Customer.AnsweredQuestion  *(external: customer, via P7)*
- Evidence.Uploaded
- Rules.Classified
- FactLedger.FieldUpdated callback

### Failure / recovery

- Ambiguous intent -> targeted clarification
- Conflicting facts -> flag and resolve
- Estimator low confidence -> wider range / more evidence
- Architecture simulation fail -> revise assumptions/resources
- Field reality -> targeted affected-node reanalysis, not full restart

### Human review

- High-risk/safety-sensitive work
- Regulatory uncertainty
- Conflicting low-confidence facts
- Very high cost/time impact
- Quality checker escalation

### Security / privacy

- Store only necessary facts
- Do not expose customer data to provider selection beyond need-to-know
- Model Gateway logging without leaking sensitive evidence
- Version every assumption and decision

### 1M-job scalability

- Fast clarification path uses deterministic FactLedger/MSI updates
- Strong models only at high-value reasoning checkpoints
- Async architecture simulation permitted
- Partition by WorkCase
- Cache task/rule metadata

### Non-negotiable invariants

- Plan before supply
- Use AI for meaning; code for authority
- Ask only material questions; never repeat known facts
- Full reanalysis only when affected scope cannot be isolated

### Integrations / callbacks

- L1 Intake
- L3 Trust/Safety
- L4 Fulfillment
- L6 Commercial
- L09A Reality callback
- P2 DecisionTrace
- P4 Model Gateway

### Golden regression scenarios

- Ground-floor statement suppresses irrelevant elevator question
- Multi-task sentence creates distinct TaskBlocks
- Field fact changes one TaskBlock without rebuilding unrelated tasks
- RequirementContract remains provider-neutral


---

## L3 — Trust, Safety, Rules & Compliance

### Purpose

Act as a blocking control surface for legal, safety, qualification and policy requirements across planning, fulfillment, preflight and execution.

### Owns

- Rule applicability
- Risk/regulatory classification
- Qualification/control requirements
- Provider eligibility rules
- Dynamic risk reassessment
- Safety holds
- Policy exceptions and manual review

### Explicitly does not own

- Task planning
- Provider ranking beyond eligibility
- Pricing
- Payment capture
- Execution state
- Outcome truth

### Inputs

- TaskBlocks/method/location
- RequirementContract
- Provider/team credentials
- Site/preflight context
- Evidence
- Versioned RulePack and regulatory sources

### Authoritative outputs

- RuleSet
- RiskProfile
- RequiredQualifications
- RequiredControls
- EligibilityDecision
- SafetyHold/Clearance
- DecisionTrace

### Engines / components

- Rule Applicability Engine
- Risk Classification Engine
- Regulatory Classifier
- Capability Policy Engine
- Provider Eligibility Rules Engine
- Dynamic Risk Engine
- Safety Hold Controller

### Main decision / operating path

1. T1 Requirement Classification during planning.
2. Issue RuleSet and controls.
3. T2 Provider/Team Eligibility before ranking.
4. Pass / PassWithControls / ManualReview / Block.
5. T3 Preflight/Field Eligibility immediately before/during work.
6. Dynamic reassessment on new reality.
7. Safety hold smallest affected scope when required.

### Gates

- T1 rules determined?
- T2 provider/team satisfies every hard requirement?
- T3 credentials/site/method still valid?
- Manual review required?

### Data objects

- RuleRelease
- RuleSet
- RiskProfile
- QualificationRequirement
- ControlRequirement
- EligibilityDecision
- SafetyHold
- PolicyException

### Events emitted

- Rules.Classified
- Eligibility.Passed
- Eligibility.PassWithControls
- Eligibility.Blocked
- SafetyHold.Placed
- SafetyHold.Cleared
- Rules.Updated  *(added by ruling: a ruleset version change is not a classification)*
- SafetySignal.Raised  *(added by ruling: L3 is the safety authority)*
- Safety.HoldRaised  *(added by ruling: P4 and L09A both react to a safety hold nobody published)*

### Events consumed

- RequirementContract.Compiled
- ProviderCandidate.Proposed
- Provider.Accepted
- Preflight.Started
- RealityCase.Created
- Incident.Reported  *(external: user or operations)*

### Failure / recovery

- Rule source unavailable -> conservative hold/manual review for material risk
- Expired credential -> block affected assignment
- Conflicting rules -> compliance review
- Unsafe field condition -> immediate hold

### Human review

- Rule conflict/ambiguity
- High/critical risk classification
- Borderline provider eligibility
- Policy exception
- Safety hold escalation

### Security / privacy

- Credential access least privilege
- Audit all rule decisions
- Effective-dated rules
- Protect sensitive provider records

### 1M-job scalability

- Versioned/cached RulePacks
- Deterministic evaluation workers
- Regional policy partitions
- Revalidate only affected entities on change

### Non-negotiable invariants

- Hard legal/safety constraints cannot be outvoted by optimization
- Eligibility at offer time does not imply dispatch readiness
- Payment never implies safety clearance

### Integrations / callbacks

- L2 Planning
- L4 Fulfillment
- L8 Preflight
- L09A Reality
- L10 Execution
- P2 DecisionTrace

### Golden regression scenarios

- Licensed trade requires qualified provider
- Credential expires after booking before dispatch
- Field discovery changes regulatory classification


---

## L4 — Fulfillment, Matching & Team Assembly

### Purpose

Resolve real people, teams, availability, resources and schedule into bookable feasible fulfillment options without weakening requirements because supply is scarce.

### Owns

- Candidate retrieval
- Hard eligibility filtering
- Team assembly and roles
- Availability and capacity
- Provider/resource feasibility
- Scheduling/routing coordination
- FulfillmentSimulation
- Feasible option ranking
- FulfillmentCostSnapshot

### Explicitly does not own

- What work is required
- Safety/rule definition
- Customer price
- Customer commitment/payment
- Execution truth
- Final settlement

### Inputs

- RequirementContract
- RuleSet and qualifications
- Provider/team profiles
- Availability/calendars
- Resource inventory
- Customer timing/location constraints
- Pricing policy inputs

### Authoritative outputs

- FeasibleFulfillmentOptions
- TeamPlan
- RolePlan
- Schedule
- RoutePlan
- Reservation intents
- FulfillmentSimulation result
- FulfillmentCostSnapshot

### Engines / components

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

### Main decision / operating path

1. Retrieve by geography/capability/time.
2. Apply hard eligibility before ranking.
3. Assemble team/roles.
4. Check availability/capacity.
5. Resolve resources with Layer 5.
6. Build schedule/route/reservations.
7. Run FulfillmentSimulation on actual configuration.
8. Reject infeasible options.
9. Rank feasible options by soft objectives.
10. Produce FulfillmentCostSnapshot.

### Gates

- All hard requirements covered?
- Every role eligible?
- Schedule/route feasible?
- Critical resources reservable?
- Bookable feasibility proven?

### Data objects

- ProviderCandidate
- TeamPlan
- RoleAssignment
- AvailabilityHold
- FulfillmentPlan
- FulfillmentSimulation
- FulfillmentCostSnapshot

### Events emitted

- CandidateSet.Retrieved
- Team.Assembled
- Availability.Confirmed
- FulfillmentSimulation.Passed
- FulfillmentOption.Generated
- Fulfillment.Failed
- Fulfillment.TeamSelected  *(added by ruling: L5 cannot resolve resources for an unknown team)*
- Provider.Declined  *(added by ruling: decline arrives at matching, not at commitment)*
- ProviderCandidate.Proposed  *(added by ruling: L3 gates candidates it is never sent)*

### Events consumed

- RequirementContract.Compiled
- Rules.Classified
- ProviderProfile.Updated  *(external: provider)*
- ResourceAvailability.Changed  *(external: partner or supplier, via P5)*
- Reschedule.Proposed

### Failure / recovery

- No feasible option -> expand search / alternate time / return to planning only if architecture itself infeasible
- Provider decline -> rematch fulfillment, not full requirement rebuild
- Resource failure -> rerun affected fulfillment path

### Human review

- Low confidence match
- No feasible option after policy search horizon
- Team role conflict
- High-cost variance

### Security / privacy

- Provider profile access limited to matching need
- No hidden soft score may bypass hard eligibility
- Audit ranking inputs

### 1M-job scalability

- Derived geo/capability/availability search index then authoritative recheck
- Parallel candidate evaluation
- Partition by region/time
- No global serial queue

### Non-negotiable invariants

- RequirementContract is authoritative for hard constraints
- Bookable feasibility precedes customer offer
- Provider acceptance occurs after customer authorization unless category policy requires otherwise

### Integrations / callbacks

- L2 Requirements
- L3 Trust/Safety
- L5 Resources
- L6 Commercial
- L7 Commitment
- L09A recovery

### Golden regression scenarios

- Two-person minimum never reduced to one because of scarcity
- Provider decline rematches only fulfillment
- No slot at requested time yields alternative feasible times


---

## L5 — Resources, Rentals, Logistics & Partners

### Purpose

Identify, source, reserve and coordinate tools, equipment, materials, vehicles, rentals, purchases and partner services using true-gap logic.

### Owns

- Resource inventory/compatibility
- True-gap calculation
- Rental/purchase/partner sourcing
- Reservation
- Pickup/delivery/return coordination
- Resource readiness and receipts

### Explicitly does not own

- Task requirements
- Provider/team matching
- Customer pricing
- Cancellation responsibility
- Execution of task itself
- Settlement authority

### Inputs

- AbstractResourcePlan
- Selected team assets
- Customer-owned resources
- Partner/rental inventory
- Location/time/route context
- Capability/safety requirements

### Authoritative outputs

- ResourcePlan
- Reservation records
- Pickup/Delivery/Return plan
- ResourceCostEstimate
- ResourceProof/Receipts
- TrueGap status

### Engines / components

- Resource Inventory Engine
- Asset Compatibility Engine
- True-Gap Resolver
- Rental/Purchase Optimizer
- Partner Availability Engine
- Reservation Engine
- Pickup/Return Route Engine

### Main decision / operating path

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

### Gates

- Resource compatible?
- Available in required time window?
- Route/return obligations feasible?
- Resource changes capability/safety classification?

### Data objects

- ResourceRequirement
- ResourceInventoryItem
- ResourceOption
- Reservation
- PickupPlan
- ReturnPlan
- Receipt
- ActualResourceCost

### Events emitted

- Resource.GapDetected
- Resource.Reserved
- Resource.Delivered
- Resource.Collected
- Resource.ReceiptUploaded
- Resource.CostUpdated
- Resource.Ready  *(added by ruling: readiness at site is distinct from reservation)*

### Events consumed

- Fulfillment.TeamSelected
- RequirementContract.Compiled
- RealityCase.Created
- Preflight.Started
- Cancellation.Requested

### Failure / recovery

- Supplier unavailable -> alternate source
- Reservation expired -> rebook and revalidate fulfillment
- Wrong item -> replace before execution
- Late delivery -> reroute/adjust or escalate

### Human review

- High-cost/specialized asset
- Multi-leg logistics
- Permit/access-dependent resource
- No viable source

### Security / privacy

- Protect supplier/customer data
- Track serials/high-value assets where needed
- Audit reservations and receipts

### 1M-job scalability

- Cached supplier catalogs
- Async partner queries
- Region-local inventory indexes
- Idempotent reservation commands

### Non-negotiable invariants

- Check customer -> provider/team -> partner/rental/purchase
- Rental pickup/return is not working time unless policy explicitly says otherwise
- No arbitrary executor-added resource charge

### Integrations / callbacks

- L2 Resources
- L4 Fulfillment
- L6 Commercial
- L7 Commitment
- L8 Preflight
- L09A Reality
- L12 Settlement

### Golden regression scenarios

- Customer owns required drill so no rental
- Team member asset closes true gap
- On-site missing fitting triggers resource recovery and actual receipt


---

## L6 — Commercial Offer & Pricing

### Purpose

Create customer-facing price/scenario offers and an immutable ScopeContract from feasible fulfillment inputs, without owning final settlement or responsibility allocation.

### Owns

- Pricing strategy/policy
- Cost composition
- Scenario pricing
- Tax determination interface
- ScopeContract
- Commercial validity/expiry
- Payment topology policy selection

### Explicitly does not own

- Provider eligibility
- Customer authorization/capture
- Cancellation reconciliation
- Outcome truth
- Final customer charge/provider payable
- Ledger

### Inputs

- RequirementContract
- Feasible fulfillment option
- FulfillmentCostSnapshot
- ResourceCostEstimate
- Location/jurisdiction
- Pricing/tax policy
- Risk/complexity profile

### Authoritative outputs

- CommercialOffer
- ScopeContract
- Price breakdown
- Taxes/fees
- Allowances/preauthorized minor variance
- Validity window
- PaymentTopologyPolicy

### Engines / components

- Cost Composition Engine
- Pricing Engine
- Tax Determination Interface
- Scenario Pricing Engine
- ScopeContract Engine
- CommercialOffer Generator
- Payment Topology Policy Engine

### Main decision / operating path

1. Take feasible fulfillment option
2. Compose direct/indirect costs
3. Apply pricing policy/margin
4. Determine tax basis
5. Build budget/recommended/full-service options where meaningful
6. Attach assumptions and validity
7. Create immutable ScopeContract
8. Present transparent commercial offer
9. Hand off selected offer to Layer 7

### Gates

- Floor/cap policy satisfied?
- Tax decision available?
- Offer still within validity?
- Price corresponds to same RC/fulfillment versions?

### Data objects

- CommercialOffer
- ScopeContract
- PriceBreakdown
- TaxDecisionRef
- Allowance
- PriceLockToken
- PaymentTopologyPolicy

### Events emitted

- CommercialOffer.Created
- CommercialOffer.Expired
- PriceOption.Selected
- ScopeContract.Created
- CommercialOffer.Selected  *(added by ruling: offer lifecycle belongs to L6; L7 cannot commit to an unselected offer)*
- CommercialDelta.Priced  *(added by ruling: L09B consumes it and only L6 may price)*
- Promotion.Updated  *(added by ruling: L6 owns pricing inputs)*

### Events consumed

- FulfillmentOption.Generated
- Resource.CostUpdated
- Rules.Updated
- Promotion.Updated

### Failure / recovery

- Missing cost input -> conservative range or block offer
- Tax uncertainty -> manual review / external authority
- Expired quote -> reprice from current fulfillment snapshot

### Human review

- Large discount/policy override
- Unusual tax/jurisdiction
- Very low pricing confidence
- High-value custom scenario

### Security / privacy

- No exposure of provider private cost detail beyond policy
- Audit pricing rule versions
- Role-based commercial access

### 1M-job scalability

- Stateless pricing workers
- Versioned price policies
- Cache tax/rate data with validity
- Async generation for complex scenarios

### Non-negotiable invariants

- Customer sees feasible options only
- Offer is based on known facts and stated assumptions
- Offer price is not final settlement after reality changes

### Integrations / callbacks

- L2 Requirements
- L4 Fulfillment
- L5 Resources
- L7 Commitment
- L12 Settlement references

### Golden regression scenarios

- Expired rental quote forces offer refresh
- Budget/recommended options differ in real feasible configuration
- Payment topology selected by contract role profile


---

## L7 — Commitment, Capacity, Rescheduling & Cancellation Architecture

### Purpose

Protect real customer/provider commitments while keeping rescheduling and cancellation fair, requestable and evidence-based.

### Owns

- Customer commitment state
- Provider acceptance state
- CapacityReservation per assigned role/person/resource
- PreparationRecord
- CommitmentSnapshot
- Reschedule strategy
- Capacity recovery/backfill
- Cancellation request and reconciliation

### Explicitly does not own

- Price calculation (L6)
- Final customer charge/provider payable/ledger (L12)
- Responsibility adjudication (09B)
- Execution truth (L10)
- Claims/disputes (L13)

### Inputs

- ScopeContract/selected offer
- Provider/team availability
- Resource reservations
- Payment authorization status from P9/L12 boundary
- Current JobOrder state
- Configurable cancellation policy
- 09B ResponsibilityAssessment when needed

### Authoritative outputs

- CommitmentConfirmation
- CapacityReservation
- RescheduleOptions
- CommitmentSnapshot
- CapacityRecoveryAttempt
- CancellationSettlementInstruction

### Engines / components

- Commitment State Engine
- Provider Acceptance Coordinator
- Capacity Reservation Engine
- Preparation Tracker
- Reschedule Engine
- Capacity Recovery Engine
- Cancellation Policy Engine
- Cancellation Reconciliation Engine

### Main decision / operating path

1. Customer selects ScopeContract and authorizes payment method/amount without implying capture/completion.
2. Provider acceptance creates capacity reservation for each role/resource.
3. Commitment state hardens according to configurable policy and actual preparation/mobilization.
4. Reschedule requests preserve same provider/team/resources first where feasible.
5. Cancellation request freezes new commitments and takes a CommitmentSnapshot.
6. Attempt capacity recovery/backfill before calculating lost reserved capacity.
7. Use evidence/policy/09B responsibility where economic allocation is contested or reality-caused.
8. Show customer applicable consequences before final cancel where policy permits.
9. Send release/refund/capture instructions to L12; L7 never edits ledger.

### Gates

- Cancellation remains requestable at every stage.
- Reschedule preservation feasible?
- Capacity successfully recovered?
- Costs real/evidenced/policy-eligible?
- High-value/disputed responsibility requires 09B/L13/manual review?

### Data objects

- CapacityReservation
- PreparationRecord
- CommitmentState
- CommitmentSnapshot
- CapacityRecoveryAttempt
- ReschedulePlan
- CancellationRequest
- CancellationSettlementInstruction

### Events emitted

- Capacity.Held
- Provider.Accepted
- Commitment.Hardened
- Reschedule.Proposed
- Cancellation.Requested
- CapacityRecovery.Completed
- Cancellation.Reconciled

### Events consumed

- CommercialOffer.Selected
- Payment.AuthorizationUpdated
- Provider.Declined
- RealityCase.Unrecoverable
- Execution.Started

### Failure / recovery

- Provider decline → L4 rematch, not L2 replan.
- Resource failure → L5 recovery.
- Customer reschedule → preserve assignment where feasible.
- Cancellation → reconcile actual protected commitment, never automatically full unperformed job.
- Backfill lowers Net Lost Reserved Capacity.

### Human review

- High-value cancellation
- Disputed economic responsibility
- Policy exception
- Fraud/abuse signal

### Security / privacy

- Clear customer disclosure
- No hidden fee logic
- Provider earnings remain private
- Audit every commitment change

### 1M-job scalability

- Region/time-partitioned capacity indexes
- Async backfill workers
- Event-driven commitment state
- Policy thresholds/configuration cached and versioned

### Non-negotiable invariants

- No universal cancellation hours/percentages are canonical.
- Cancellation remains requestable.
- Voluntary cancellation ≠ Field Reality Block.
- ProtectedProviderPayable and customer liability are different quantities.
- Net Lost Reserved Capacity = Reserved Capacity − Successfully Reallocated Capacity.
- Customer never automatically pays full original price for unperformed work.

### Integrations / callbacks

- L4 Fulfillment
- L5 Resources
- L6 Commercial
- L8 Preflight
- L09B Fairness
- L12 Settlement
- L13 Claims

### Special control — CANCELLATION, CAPACITY & FAIRNESS PROTOCOL

- Commitment state
- FREE/LOW → COMMITMENT BEGINS → CAPACITY
- LOCKED → MOBILIZED → WORK STARTED. Exact thresholds are configurable policy, not canonical fixed hours.
- Cancellation path
- Freeze new commitments → CommitmentSnapshot → reschedule test → capacity recovery/backfill → unavoidable eligible cost → responsibility allocation → customer confirmation → Layer 12 settlement.
- Provider protection
- Preparation + mobilization + actual work/diagnosis + net lost reserved capacity
- + eligible external costs, calculated per assigned role/person.
- Customer protection
- Never automatically charge the full unperformed job. Customer share requires evidence and policy; voluntary cancellation differs from field-blocked recovery.
- Retention strategy
- Prefer reschedule/recovery before closure; same team where feasible; RecoveryCredit can be Doneeo-funded.


---

## L8 — Execution Preparation, Preflight & Dispatch Architecture

### Purpose

Convert a committed booking into a dispatch-ready, role-scoped mission by revalidating time-sensitive credentials, resources, access and site readiness.

### Owns

- MissionPackage compilation
- Role-scoped executor briefing
- Team coordination
- Resource/material/rental readiness
- Access/recipient readiness
- T3 eligibility invocation
- Dispatch readiness
- En-route handoff

### Explicitly does not own

- Live execution (L10)
- Requirement architecture (L2)
- Safety/rule authority (L3)
- Pricing (L6)
- Final settlement (L12)
- Outcome verification (L11)

### Inputs

- Committed ScopeContract
- RequirementContract
- Accepted team/roles
- CapacityReservations
- Resource reservations
- Access/recipient context
- Current rules/credentials
- Schedule/route

### Authoritative outputs

- MissionPackage
- ProviderBrief
- PreflightChecklist
- ResourceReadiness
- AccessReadiness
- DispatchDecision
- ExecutionReady

### Engines / components

- Mission Compiler
- Executor Briefing Engine
- Team Coordination Engine
- Preflight Engine
- Credential Revalidation Coordinator
- Resource Confirmation Engine
- Access Readiness Engine
- Dispatch Controller

### Main decision / operating path

1. Compile role-scoped mission from current authoritative versions.
2. Confirm team/role acceptance and handoff context.
3. Confirm tools/materials/rentals/vehicle readiness.
4. Invoke L3 T3 current credential/site/method eligibility.
5. Confirm access, recipient, parking/floor/time-window conditions.
6. Resolve blockers through L4/L5/L7 without changing requirement unless 09A/L2 says so.
7. Gate Dispatch.Ready only after all hard readiness checks pass.
8. Dispatch and hand ExecutionReady package to L10.
9. Arrival may immediately invoke 09A On-Site Reality Check.

### Gates

- All assigned roles present?
- Critical resources confirmed?
- T3 clearance current?
- Access/start window confirmed?
- Dispatch safe and feasible?

### Data objects

- MissionPackage
- ProviderBrief
- PreflightChecklist
- ResourceReadiness
- CredentialCheckRef
- AccessReadiness
- DispatchDecision

### Events emitted

- Preflight.Started
- Preflight.Passed
- Preflight.Blocked
- Dispatch.Ready
- Provider.EnRoute

### Events consumed

- Provider.Accepted
- Resource.Reserved
- Credential.Updated  *(external: provider or issuing authority, via P5)*
- Context.Updated
- Cancellation.Requested

### Failure / recovery

- Credential expiry → hold affected role + L4 rematch.
- Rental unavailable → L5 recovery before dispatch.
- Access unavailable → L7 reschedule/contact.
- Team member decline → replace role only.

### Human review

- Credential conflict
- High-risk access/site
- Critical resource unresolved
- Manual exception request

### Security / privacy

- Executor sees mission-relevant customer data only.
- Recipient visibility scoped by P3.
- No unnecessary financial/customer history exposed.

### 1M-job scalability

- Parallel preflight checks
- Authoritative recheck before dispatch
- Regional dispatch queues
- WorkCase/JobOrder ordered events

### Non-negotiable invariants

- Provider acceptance ≠ dispatch readiness.
- Payment authorization ≠ dispatch readiness.
- L8 ends at ExecutionReady/Dispatch; L10 owns live execution.
- Arrival Reality Check is separate from pre-departure preflight.

### Integrations / callbacks

- L3 Trust/Safety
- L4 Fulfillment
- L5 Resources
- L7 Commitment
- L09A Reality
- L10 Execution


---

## L09A — Reality & Recovery Decision Architecture

### Purpose

Reconcile the approved plan with physical reality and find the fastest safe recovery path while preserving unaffected work and authority boundaries.

### Owns

- RealityCase
- Field evidence + Field MSI
- FactLedger field updates
- Semantic R0–R5 impact classification
- Dependency impact analysis
- Safety interrupt routing
- Fastest-safe-solution hierarchy
- Targeted reanalysis coordination
- Resume/branch/partial-close decision

### Explicitly does not own

- Responsibility/economic allocation (09B)
- Pricing revised work (L6)
- Final cancellation settlement (L7/L12)
- Final outcome truth (L11)

### Inputs

- RequirementContract
- WorkPlan
- Execution state
- Field observations/photos/measurements
- Current rules
- Provider/resource availability

### Authoritative outputs

- RealityCase
- ChangedFact
- FieldMSI
- ImpactClassification
- RecoveryDecision
- TargetedReanalysisRequest
- BranchRequest
- ResumeDecision

### Engines / components

- Reality Reconciliation Engine
- Field Evidence Engine
- Field MSI Resolver
- Semantic R0–R5 Classifier
- Dependency Impact Analyzer
- Safety Interrupt Router
- Recovery Optimizer
- Targeted Reanalysis Coordinator
- Branch Decision Engine
- Resume Controller

### Main decision / operating path

1. Observe/verify actual condition.
2. Create RealityCase and capture evidence.
3. Append changed fact preserving superseded value/provenance.
4. Classify semantic R0–R5 impact.
5. R4 immediately holds smallest safe affected scope and calls L3.
6. Analyze affected TaskBlocks/dependencies/resources/completion criteria.
7. Search hierarchy: current executor → small resource adjustment → redistribute team/resources → add support → continue unaffected tasks → replace affected role → prerequisite branch → targeted TaskBlock rearchitecture → full JobOrder replan → cancel affected scope last resort.
8. R2 invokes L4/L5 recovery without changing RequirementContract.
9. R3 invokes L2 targeted reanalysis only for affected nodes.
10. R5 remains CandidateFollowUp unless necessary prerequisite and approved.
11. Request approval only when scope/price/time/policy requires it.
12. Resume/branch/partial close through P1/L10.

### Gates

- R0 Confirmed as planned
- R1 Minor operational variance
- R2 Fulfillment/resource variance
- R3 Requirement-impacting condition
- R4 Safety/regulatory change
- R5 Independent new work

### Data objects

- RealityCase
- ChangedFact
- FieldMSI
- ImpactClassification
- RecoveryOption
- RecoveryDecision
- BranchRelationshipRequest
- DecisionTrace

### Events emitted

- RealityCase.Created
- FactLedger.FieldUpdated
- RecoveryOption.Selected
- TargetedReanalysis.Requested
- Branch.Requested
- Execution.ResumeRequested
- RecoveryDecision.Approved  *(added by ruling: L09A owns RecoveryDecision and never published it)*
- RealityCase.Unrecoverable  *(added by ruling: L7's cancellation path has no trigger without it)*

### Events consumed

- Execution.IssueDetected
- Provider.FieldObservation
- Customer.FieldUpdate  *(external: customer, via P7)*
- SafetySignal.Raised

### Failure / recovery

- Unsafe condition → immediate smallest-safe-scope hold.
- No resource solution → expand L4/L5 search.
- Cannot isolate impact → full replan last resort.
- No safe/viable recovery or customer declines → L7 cancellation path.

### Human review

- R4 safety/regulatory
- High-impact ambiguous reality
- Major scope/cost/time change
- Disputed field facts

### Security / privacy

- Evidence tied to WorkCase/TaskBlock.
- Executor submits facts, not blame or self-priced changes.
- Field evidence immutable by reference.

### 1M-job scalability

- Low-latency Field MSI
- Affected-node reanalysis
- Parallel recovery search
- WorkCase ordered events

### Non-negotiable invariants

- R0–R5 are semantic classes, NOT severity.
- Physical reality is authoritative but cannot bypass controls.
- Solution before broad replanning.
- Continue unaffected TaskBlocks when dependencies/safety allow.
- Full replan and cancellation are last resort.

### Integrations / callbacks

- L2 Intelligence
- L3 Trust/Safety
- L4 Fulfillment
- L5 Resources
- L7 Cancellation last resort
- L09B Fairness
- L10 Execution
- P2 FactLedger

### Special control — R0–R5 SEMANTIC IMPACT + FASTEST-SAFE-SOLUTION

- R0
- Confirmed as planned
- Execute approved plan
- R1
- Minor operational variance
- Adjust locally; no architecture change
- R2
- Fulfillment/resource variance
- Requirement valid; change provider/resource
- R3
- Requirement-impacting condition
- Targeted Intelligence reanalysis
- R4
- Safety/regulatory change
- Immediate affected-scope hold + L3
- R5
- Independent new work
- CandidateFollowUp/branch with consent
- 1 Current executor
- 2 Small resource adjustment
- 3 Redistribute team/resources
- 4 Add helper/specialist
- 5 Continue unaffected TaskBlocks
- 6 Replace affected role/provider
- 7 Prerequisite branch
- 8 Targeted TaskBlock rearchitecture
- 9 Full JobOrder replan
- 10 Cancel affected scope — last resort


---

## L09B — Responsibility & Fairness Economic Architecture

### Purpose

Determine fair economic consequences using evidence, causality and policy while keeping provider protection, customer liability and Doneeo absorption independent.

### Owns

- Causality classification
- Customer/provider/Doneeo/external responsibility tests
- Capacity-loss input after recovery
- ProtectedProviderPayable
- CustomerRealityAdjustment
- DoneeoAbsorption / RecoveryCredit
- AdjustmentInstruction
- Responsibility DecisionTrace

### Explicitly does not own

- Weighted blame scoring
- Pricing new work (L6)
- Final capture/refund/ledger (L12)
- Claims appeal adjudication (L13)
- Safety authority (L3)

### Inputs

- RealityCase/recovery path (09A)
- Changed facts/evidence
- FactLedger/question history
- ScopeContract
- Provider obligations/preparation
- CapacityReservation + CapacityRecoveryAttempt (L7)
- CommercialDelta price (L6)
- Actual resource receipts

### Authoritative outputs

- ResponsibilityAssessment
- ProtectedProviderPayable
- CustomerRealityAdjustment
- DoneeoAbsorption
- RecoveryCredit
- AdjustmentInstruction

### Engines / components

- Causality Classifier
- Responsibility Policy Engine
- Customer Material-Fact Test
- Provider Obligation/Performance Test
- Doneeo Control/Planning Test
- Provider Protection Engine
- Capacity Loss Calculator
- Customer Adjustment Engine
- DoneeoAbsorption/Credit Engine

### Main decision / operating path

1. Classify canonical cause taxonomy.
2. Test customer responsibility: material fact + Doneeo asked/disclosed importance + customer could reasonably know + inaccurate/omitted + causal link; if Doneeo reasonably should have asked but did not, customer responsibility is not presumed.
3. Assess provider responsibility from obligation, preparation and performance evidence.
4. Assess Doneeo responsibility from planning/system/marketplace control.
5. Consume L7 capacity-recovery result before net lost-capacity calculation.
6. Calculate PPP per assigned role/person/resource: preparation + mobilization + actual work/diagnosis + net lost reserved capacity + eligible external costs.
7. Use L6 price for approved revised work; 09B allocates economic responsibility, it does not price.
8. Calculate customer adjustment only from evidence-backed responsibility/approved work/resources minus credits/unperformed amounts.
9. Calculate Doneeo/partner absorption and RecoveryCredit.
10. Routine clear cases deterministic; high-value/disputed/mixed/undetermined → human/L13.
11. Send approved instruction to L12.

### Gates

- Evidence sufficient?
- Customer material-fact test established?
- Provider protection eligibility?
- High-value/disputed/mixed/undetermined cause?
- Policy exception?

### Data objects

- ResponsibilityAssessment
- ProtectedProviderPayable
- CustomerRealityAdjustment
- DoneeoAbsorption
- RecoveryCredit
- AdjustmentInstruction
- EvidenceBundleRef
- DecisionTrace

### Events emitted

- Responsibility.Assessed
- ProviderProtection.Calculated
- CustomerAdjustment.Calculated
- RecoveryCredit.Applied
- AdjustmentInstruction.Approved

### Events consumed

- RecoveryOption.Selected
- CapacityRecovery.Completed
- CommercialDelta.Priced
- Outcome.ActualsAvailable
- Cancellation.Requested

### Failure / recovery

- Insufficient evidence → no automatic customer blame.
- Mixed cause → policy allocation without weighted score overriding hard rules.
- Dispute → L13.
- Payment failure → L12/P9 FinanceOps path.

### Human review

- High-value impact
- Disputed causality
- Appeal
- Potential fraud/abuse

### Security / privacy

- No public blame labels.
- Evidence/rationale access scoped.
- Provider private economics protected.

### 1M-job scalability

- Deterministic policy evaluation
- Per-role PPP parallel calculation
- Analytics separated from authoritative assessment

### Non-negotiable invariants

- NO weighted blame engine.
- PPP ≠ customer liability ≠ Doneeo absorption.
- Doneeo planning error does not become customer surcharge.
- Hidden condition alone does not create customer liability.
- Customer declining revised work does not make revised job/full original price automatically owed.

### Integrations / callbacks

- L09A Reality
- L7 Cancellation
- L12 Settlement
- L13 Claims
- L3 Trust/Safety where required

### Special control — CAUSALITY & THREE-WAY ECONOMIC FAIRNESS

- Causality
- Hidden condition; customer inaccurate/omitted fact; customer scope change; Doneeo planning error; provider prep/execution failure; resource/partner failure; external; safety/regulatory; mixed; undetermined.
- Customer responsibility test
- Material fact? Doneeo asked/disclosed?
- Customer could reasonably know?
- Inaccurate/omitted? Causal link? Did Doneeo ignore contradictory evidence?
- ProtectedProviderPayable
- Preparation + mobilization + actual work/diagnosis + net lost reserved capacity after backfill + eligible external costs.
- Calculate per role/person.
- CustomerRealityAdjustment
- Completed/approved work + eligible customer- responsible disruption/resources − credits − unperformed amounts.
- DoneeoAbsorption / RecoveryCredit
- Platform share for Doneeo/marketplace risk, partner responsibility, retention or policy- defined recovery.
- NO weighted blame engine. Responsibility = evidence + causality + policy. Provider payable, customer liability and Doneeo absorption are never forced to be equal.


---

## L10 — Live Execution & Change Control

### Purpose

Control TaskBlock execution, milestones, timing, evidence, handoffs and issue/change detection; route material reality changes to 09A rather than improvising scope.

### Owns

- Execution state machine
- TaskBlock progression
- Milestones/checkpoints
- ExecutionJournal
- Live timing/ETA
- Handoffs
- Issue/change detection
- Approved adaptation application
- Completion submission

### Explicitly does not own

- Requirement architecture
- Responsibility allocation
- Final outcome verification
- Pricing/settlement
- Claims

### Inputs

- Execution-ready MissionPackage
- WorkPlan
- TaskGraph/dependencies
- Resources
- CompletionSpecification
- Customer/recipient communication rules

### Authoritative outputs

- ExecutionState
- ExecutionJournal
- MilestoneRecord
- IssueSignal
- ChangeEvent
- HandoffRecord
- CompletionSubmission

### Engines / components

- Execution State Engine
- TaskBlock Controller
- Milestone Engine
- ExecutionJournal Writer
- Live Timing Engine
- Handoff Controller
- Change Event Detector
- Adaptation Applier
- Completion Submission Engine

### Main decision / operating path

1. ExecutionReady
2. Start TaskBlock / actual timer
3. Track progress and milestones
4. Append actions/evidence to journal
5. Detect issue/change
6. Material reality? -> 09A callback
7. Apply approved recovery/plan version
8. Continue unaffected tasks
9. Handoff if role/stop changes
10. Submit completion package to L11

### Gates

- Task prerequisites satisfied?
- Can next TaskBlock start?
- Issue requires 09A?
- Handoff acknowledged?
- Completion package complete?

### Data objects

- ExecutionState
- ExecutionJournalEntry
- MilestoneRecord
- ActualTime
- IssueSignal
- HandoffRecord
- CompletionSubmission

### Events emitted

- Execution.Started
- Milestone.Reached
- Issue.Detected
- RealityCase.Requested
- Handoff.Completed
- Completion.Submitted
- Execution.IssueDetected  *(added by ruling: L10 detects; L09A reacts)*
- Provider.FieldObservation  *(added by ruling: the executor reports through live execution)*

### Events consumed

- Dispatch.Ready
- RecoveryDecision.Approved
- RequirementContract.Superseded
- Resource.Ready

### Failure / recovery

- Network outage -> offline-safe journal queue then reconcile
- Provider no-show -> fulfillment recovery
- Unsafe event -> L3 hold via 09A
- Handoff failure -> pause dependent work only

### Human review

- High-impact issue
- Customer complaint during work
- Safety incident
- Completion exception

### Security / privacy

- Role-scoped live data
- Location tracking only when required
- Evidence retention policy
- Audit every adaptation

### 1M-job scalability

- Event-driven live updates
- WorkCase/JobOrder scoped ordering
- Read models for customer/executor UI
- AI not on critical path for timer/state

### Non-negotiable invariants

- Execution never self-expands scope
- Journal append-only
- Actuals are evidence, not automatically customer charges
- Continue unaffected work where safe

### Integrations / callbacks

- L8 Dispatch
- L09A Reality
- L09B Fairness economic signal
- L11 Outcome
- P1 Orchestrator

### Golden regression scenarios

- Delay changes ETA without RC change
- Hidden condition triggers 09A
- Provider handoff preserves context and evidence


---

## L11 — Outcome, Completion & Evidence Architecture

### Purpose

Establish authoritative physical outcome by verifying execution evidence against the approved CompletionSpecification and requirement/change versions.

### Owns

- Completion submission validation
- CompletionSpecification verification
- Evidence integrity
- TaskBlockCompletionDecision
- JobOrderCompletionDecision
- VerifiedActuals
- OutcomeRecord
- Actual-vs-estimate variance report

### Explicitly does not own

- Customer charge/provider payable
- Responsibility allocation
- Claims adjudication
- New planning except explicit remediation/reality callbacks

### Inputs

- CompletionSubmission
- CompletionSpecification
- RequirementContract version
- Approved recovery/change versions
- ExecutionJournal
- Evidence
- Actual time/resources/materials
- Customer/recipient acknowledgement

### Authoritative outputs

- TaskBlockCompletionDecision
- JobOrderCompletionDecision
- OutcomeRecord
- VerifiedActuals
- SettlementInput
- OutcomeReport
- RemediationRequest

### Engines / components

- Submission Validator
- CompletionSpecification Validator
- Evidence Validator
- Outcome Verifier
- Variance Reporter
- Customer Acknowledgement Engine
- Outcome Recording Engine

### Main decision / operating path

1. Receive submission from L10; 'Done' is only a submission signal.
2. Validate required evidence and integrity.
3. For each TaskBlock compare actuals to CompletionSpecification success criteria/postconditions.
4. Record TaskBlock completion: verified complete / partial / verification failed / remediation required / disputed.
5. Evaluate JobOrder completion eligibility across contracted scope and approved changes.
6. Customer acknowledgement is evidence; non-response cannot leave job indefinitely open when objective evidence suffices.
7. If new physical fact appears, call 09A.
8. If economic responsibility issue exists, call 09B.
9. If remediation/dispute required, call L13.
10. Publish VerifiedActuals/SettlementInput directly to L12 for normal completion.
11. Close JobOrder only when contracted scope + approved changes satisfy closure policy; WorkCase may remain open for branches.

### Gates

- Required evidence present?
- CompletionSpecification satisfied?
- TaskBlock dependencies complete?
- JobOrder completion eligible?
- Dispute/remediation required?

### Data objects

- CompletionSubmission
- TaskBlockCompletionDecision
- JobOrderCompletionDecision
- OutcomeRecord
- EvidenceBundle
- VerifiedActuals
- VarianceRecord
- SettlementInput

### Events emitted

- Outcome.TaskBlockVerified
- Outcome.JobOrderCompletionEligible
- Outcome.RemediationRequired
- Outcome.Disputed
- SettlementInput.Ready
- Outcome.ActualsAvailable  *(added by ruling: L09B needs verified actuals, not the settlement input)*

### Events consumed

- Completion.Submitted
- RecoveryDecision.Approved
- RequirementContract.Superseded
- Customer.Acknowledged  *(external: customer, via P7)*

### Failure / recovery

- Missing evidence → request specific evidence.
- Failed criterion → correction/remediation path.
- Customer unavailable → objective evidence/policy.
- Dispute → L13.

### Human review

- High-value outcome
- Conflicting evidence
- Safety incident tied to completion
- Customer rejection with evidence conflict

### Security / privacy

- Evidence immutable after lock.
- Read-only customer/provider evidence views.
- Retention by evidence type.

### 1M-job scalability

- Parallel TaskBlock verification
- Async media checks
- No AI-only authority for hard completion criteria

### Non-negotiable invariants

- CompletionSpecification is the central success authority.
- Customer acceptance is evidence, not sole authority.
- Done/Submit ≠ Completed.
- Blocked execution is not automatically a terminal outcome.
- Cancelled is final only when L7 finalizes cancellation.
- JobOrder closure ≠ WorkCase closure.
- Actual cost facts are not automatically customer charges.

### Integrations / callbacks

- L10 Execution
- L12 Settlement
- L13 Branch/Claims
- P2 Evidence

### Outcome state machine

> Recovered 2026-08-23 from "Layer 11 Outcome Truth Architecture.png" — a
> version 1.2 board dated 2026-08-19 that appears in NEITHER the FULL_DETAIL
> package nor the v2.1 reconciliation evidence. It exists only in the figma
> folder. No other document in the architecture carries this state machine.

- S0 RECEIVED — submission received from Layer 10
- S1 UNDER REVIEW (AUTO) — validation and reconciliation in progress
- S2 COMPLETE — all TaskBlocks completed successfully
- S3 PARTIAL — some completed, some not (defined)
- S4 BLOCKED (UNAVOIDABLE) — could not proceed further
- S5 CANCELLED (BY POLICY) — cancelled via Layer 07 decision
- S6 DISPUTED — outcome contested / needs review
- S7 FAILED — execution failure / no deliverable
- S8 LOCKED (FINAL) — outcome immutable and published

Transitions:

- S0 -> S1 on valid submission
- S1 -> S2/S3/S4/S6/S7 based on evaluation
- **Any -> S5 on cancellation from L07**
- S1/S3/S4/S6 -> S8 after acceptance / review
- S6 -> S1 after dispute resolution
- S2/S3/S4/S7 -> S6 if dispute raised

`Any -> S5` is the formal expression of L7's invariant that cancellation
remains requestable at every stage. It is the only place in the architecture
where that invariant is made mechanical rather than stated in prose.

Outcome invariants, as printed:

- Outcome is based on facts, not opinions
- Evidence is immutable once locked
- Outcome cannot be edited, only appended
- Every outcome has OutcomeReason and timestamp
- All links and decisions are traceable

### Outcome response types

- OR-COMPLETE — All Work Completed — all TaskBlocks done as planned — e.g. IKEA table delivered and old table removed
- OR-PARTIAL — Partial Completion — some done, some pending — e.g. 12 desks moved, 3 pending
- OR-BLOCKED — Blocked / Unavoidable — could not proceed further — e.g. no elevator access available
- OR-CANCELLED — Cancelled by Policy — cancelled via Layer 07 — e.g. customer cancelled with fee
- OR-DISPUTED — Disputed — outcome contested — e.g. customer claims incomplete
- OR-FAILED — Execution Failure — work could not be executed — e.g. provider could not complete
- OR-OTHER — Other — other defined reason — e.g. weather stopped work

FactLedger linkage: OutcomeRecord (11) -> ResponsibilityCase (09B) ->
LedgerInstruction (12), only after outcomes and responsibility are finalized.


---

## L12 — Settlement, Ledger, Reconciliation & FinanceOps

### Purpose

Calculate final customer charge, provider payable, refunds/releases, taxes and ledger postings from verified actuals and responsibility decisions, with append-only accounting and reconciliation.

### Owns

- Final settlement calculation
- Payment capture/release/refund coordination
- Provider payable
- Tax settlement references
- Append-only double-entry ledger
- Reconciliation
- FinanceOps exceptions/holds/retries/reversals

### Explicitly does not own

- Work planning
- Safety qualification
- Outcome truth
- Claims physical truth
- Editable balances/history

### Inputs

- ScopeContract
- Payment authorization state
- Outcome SettlementInput
- 09B responsibility allocation
- CancellationSettlementInstruction
- Resource actuals/receipts
- TaxDecision refs

### Authoritative outputs

- FinalCustomerCharge
- ProviderPayable
- Refund/ReleaseInstruction
- LedgerEntries
- ReconciliationRecord
- FinanceException

### Engines / components

- Settlement Engine
- Customer Charge Engine
- Provider Payable Engine
- Payment Adapter Coordinator
- Refund/Release Engine
- Tax Settlement Engine
- Ledger Posting Engine
- Reconciliation Engine
- FinanceOps Exception Engine

### Main decision / operating path

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

### Gates

- Outcome verified or approved partial close?
- Customer charge policy-compliant?
- Ledger balanced?
- Idempotency key seen?
- External settlement reconciled?

### Data objects

- PaymentAuthorization
- Capture
- Refund
- ProviderPayable
- LedgerEntry
- LedgerTransaction
- ReconciliationRecord
- FinanceException

### Events emitted

- Settlement.Calculated
- Payment.Captured
- Refund.Issued
- ProviderPayable.Created
- Ledger.Posted
- Reconciliation.Completed
- FinanceException.Opened
- Payment.AuthorizationUpdated  *(added by ruling: L7 gates commitment on it)*
- Payment.Disputed  *(added by ruling: L13 opens claims from it)*
- Settlement.FinancialCommand  *(added by ruling: the L12->P9 rail command was never emitted)*

### Events consumed

- SettlementInput.Ready
- Responsibility.Assessed
- Cancellation.Reconciled
- PSP.CallbackReceived  *(external: payment service provider, via P9)*
- Bank.SettlementReceived  *(external: bank, via P9)*

### Failure / recovery

- Callback lost → inbox/outbox replay.
- Duplicate webhook → dedupe.
- PSP failure → retry/hold.
- Reconciliation mismatch → FinanceOps exception.
- Never direct-edit balances.

### Human review

- High-value adjustment
- Chargeback/dispute
- Tax ambiguity
- Repeated PSP failure
- Reconciliation break

### Security / privacy

- PCI/tokenization boundaries
- Finance role access
- Append-only audit
- No raw secrets in logs

### 1M-job scalability

- Persistent idempotency
- Transactional inbox/outbox
- Independent payment/reconciliation workers
- Partition ledger by legal/entity policy while preserving balanced books

### Non-negotiable invariants

- Payment never implies safe/assigned/ready/completed.
- Customer charge ≠ provider payable.
- FinanceOps cannot rewrite physical truth or ledger history.
- No direct DB edits.
- Doneeo/partner share absorbs platform/partner responsibility and Recovery Credits without silently shifting it to customer or executor.
- Append-only balanced postings; idempotent PSP commands; transactional inbox/outbox; reconciliation; FinanceOps exceptions; no direct balance edits.

### Integrations / callbacks

- L6 Commercial
- L7 Cancellation
- L09B Fairness
- L11 Outcome
- L13 Claims
- P1/P2

### Special control — FINAL SETTLEMENT TRUTH

- Customer final charge
- Completed contracted work + approved additions + eligible customer-responsible disruption + approved resource actuals − credits − unperformed amounts.
- Provider payable
- Completed work + policy-eligible preparation/mobilization/diagnosis + net protected capacity + eligible external costs.
- Doneeo / partner share
- Absorb platform/partner responsibility and Recovery
- Credits without silently shifting it to customer or executor.
- Ledger & reconciliation
- Append-only balanced postings; idempotent PSP commands; transactional inbox/outbox; reconciliation; FinanceOps exceptions; no direct balance edits.

### Golden regression scenarios

- Provider paid while Doneeo absorbs planning error
- Unused authorization released after partial close
- Lost callback replay causes no duplicate financial effect


---

## L13 — Branch, Continuity, Claims & Support Architecture

### Purpose

Preserve WorkCase continuity through linked JobOrders and resolve claims/support without mutating closed physical or financial truth.

### Owns

- BranchRelationship
- Prerequisite/follow-up/remediation/warranty/incident/customer-added branches
- CandidateFollowUp conversion
- WorkCase continuity
- Claims/disputes/support cases
- Remedies/appeals

### Explicitly does not own

- Rewriting OutcomeRecord (L11)
- Rewriting ledger balances/history (L12)
- Provider eligibility (L3/L4)
- Pricing (L6)
- Original requirement truth

### Inputs

- RealityCase/BranchRequest
- OutcomeRecord
- ResponsibilityAssessment
- Settlement/Ledger references
- Customer/provider messages
- Incident evidence

### Authoritative outputs

- BranchJobOrderRequest
- BranchRelationship
- ContinuityPlan
- ClaimCase
- DisputeDecision
- RemedyInstruction
- SupportTimeline

### Engines / components

- Branch Manager
- Dependency Controller
- Continuity Engine
- FollowUp Consent Engine
- Claims Case Engine
- Dispute Resolution Engine
- Remedy Engine
- Support Workflow

### Main decision / operating path

1. Classify newly discovered work as necessary current step, material prerequisite, independent follow-up, remediation, customer-added scope, incident recovery or warranty rework.
2. Create BranchRelationship only when separate JobOrder boundary is warranted.
3. PREREQUISITE_FOR blocks only dependent parent TaskBlocks; unaffected tasks continue.
4. FOLLOW_UP_TO never keeps completed parent JobOrder open.
5. CandidateFollowUp requires customer consent and normal eligibility/matching; no automatic upsell or executor reservation.
6. Claims intake locks evidence references and reconstructs timeline.
7. Apply claim/dispute policy; human review/appeal where required.
8. Financial remedy is sent to L12 as instruction; physical remediation creates/links branch through normal lifecycle.
9. Close case without rewriting L11/L12 source truth.

### Gates

- Separate JobOrder needed?
- Branch blocks which TaskBlocks?
- Customer consent for independent work?
- Claim eligible/in window?
- Appeal/manual review required?

### Data objects

- BranchRelationship
- BranchJobOrderRef
- ContinuityPlan
- CandidateFollowUp
- ClaimCase
- DisputeCase
- RemedyInstruction
- AppealRecord

### Events emitted

- Branch.Created
- Branch.BlockedParent
- Branch.Completed
- Claim.Opened
- Claim.Resolved
- Dispute.Decided
- Remedy.Issued

### Events consumed

- Branch.Requested
- Outcome.RemediationRequired
- Customer.Complaint  *(external: customer, via P7)*
- Payment.Disputed
- Incident.Reported  *(external: user or operations)*

### Failure / recovery

- Branch dependency unresolved → only dependent scope blocked.
- Evidence conflict → manual claims review.
- Financial remedy → L12; never edit ledger directly.
- Safety-related remediation → L3 before re-execution.

### Human review

- Damage/loss claim
- High-value dispute
- Safety incident liability
- Appeal

### Security / privacy

- Need-to-know evidence access
- Redact unrelated case data
- Access audited

### 1M-job scalability

- Claims/support off critical execution path
- Async evidence retrieval
- Partition by WorkCase/Case ID

### Non-negotiable invariants

- WorkCase may outlive a JobOrder.
- Branch types: PREREQUISITE_FOR, FOLLOW_UP_TO, REMEDIATION_FOR, CUSTOMER_ADDED_SCOPE, INCIDENT_RECOVERY, WARRANTY_REWORK.
- Independent observed work never becomes current billable scope without consent.
- Claims/support consume source truth; they do not rewrite it.

### Integrations / callbacks

- L09A Reality
- L09B Fairness
- L11 Outcome
- L12 Settlement
- P3 Identity


---

## P1 — Platform Orchestrator, Workflow & State Control

### Purpose

Provide durable workflow coordination, command/event routing, version lineage, idempotency, concurrency control, sagas and callbacks while preserving domain ownership.

### Owns

- Workflow coordination
- State transition guards
- Command routing
- Event orchestration
- Version lineage
- Sagas/compensation
- Idempotency/concurrency
- Human-review routing

### Explicitly does not own

- Planning/safety/pricing/fulfillment/outcome domain decisions
- Direct ledger edits
- Arbitrary cross-domain writes

### Inputs

- Commands/events from all layers
- Current aggregate versions
- Policy for routing/retries
- Human review decisions

### Authoritative outputs

- State transitions
- Command acknowledgements
- Domain event envelopes
- Saga state
- Idempotency records
- Review tasks

### Engines / components

- E1 Command Router
- E2 Event Orchestrator
- E3 State Machine Coordinator
- E4 Version/Lineage Manager
- E5 Saga Manager
- E6 Idempotency Controller
- E7 Concurrency Controller
- E8 Review Router

### Main decision / operating path

1. Receive command
2. Validate caller/version/state
3. Route to smallest correct owner
4. Persist idempotency/transition intent
5. Domain performs decision
6. Consume resulting event
7. Advance workflow/saga
8. Retry/compensate on failure
9. Publish read-model update

### Gates

- Expected version matches?
- Transition allowed?
- Command duplicate?
- Compensation required?
- Human review pending?

### Data objects

- CommandEnvelope
- EventEnvelope
- StateTransition
- SagaState
- IdempotencyKey
- ReviewTask
- VersionRef

### Events emitted

- Workflow.Advanced
- Saga.Compensated
- Review.Requested
- Command.RejectedStaleVersion

### Events consumed

- All domain events

### Failure / recovery

- At-least-once duplicate -> idempotent consumer
- Stale version -> reject/reload
- Partial saga -> compensating action
- Downstream unavailable -> queue/retry/DLQ

### Human review

- Cross-domain manual review
- Irreversible high-impact action
- Repeated saga failure

### Security / privacy

- Service identity/auth
- Audit command actors
- No secrets in events
- Least privilege event consumers

### 1M-job scalability

- Logical boundaries separable later; modular monolith now
- WorkCase-scoped ordering
- Transactional outbox/inbox
- No global serial queue

### Non-negotiable invariants

- Orchestrator coordinates; domains decide
- No God Object
- Design for failure
- Commands and events are distinct

### Integrations / callbacks

- All layers
- P2 Data
- P3 Identity
- P6 (Event Backbone, Model Gateway & Observability)

### Orchestration principles (non-negotiable)

> Recovered 2026-08-23 from a P1 v1.0 board dated 2026-08-19, present only in
> the figma folder and in neither package.

- Deterministic Orchestration — same input + state = same orchestration
- State is the Source of Truth
- No God Object
- **Idempotent by Design — every command safe to retry**
- WorkCase Scoped Ordering — strong order within WorkCase
- Explicit Version Control — no stale updates, ever
- Failure is Normal — retry, compensate, continue safely
- Observable & Traceable — every step logged and correlated

### Recovered component detail

Saga / Transaction Manager:

- Orchestrates long-running sagas
- Step lifecycle management
- Timeout and retry policy
- Compensation orchestration
- Atomicity across distributed steps

Idempotency Controller:

- Idempotency keys registry
- Duplicate detection
- **Safe replay handling**
- **Exactly-once effect guarantee**
- Per command / per step

Concurrency & Lock Manager:

- Optimistic concurrency
- Stale version detection
- WorkCase scoped locks
- Conflict detection / resolution
- Prevents lost updates

Dead Letter Manager: failed event handling · quarantine management ·
reprocess / replay · root cause tracking · operator tooling

Audit & Trace Logger: immutable orchestration logs · step-by-step trace ·
correlation ID propagation · causal graph logging · tamper-evident storage

Orchestration data ownership: P1 owns orchestration metadata only — state,
versions, logs, lineage. Domain layers own their data. P1 guarantees integrity
and flow, not business truth.

Step flow: Execute Step / Call Domain -> Success? -> yes: Record Result and
Advance State -> Complete or Next Step -> End / Idle. On no: Handle Failure
(Retry / Compensate).

FactLedger linkage: WorkCase (01) -> Plan / Versions (02) -> Execution (08) ->
Outcome (11) -> Claim (13) -> Data / Insights (14).

> **Idempotent by Design**, **safe replay handling** and **exactly-once effect
> guarantee** are three statements of the same property on one board. The repo's
> chained-retry defect violates it, and scenario P1-G1 in
> `tests/architecture-scenarios.test.ts` documents that violation.

### Golden regression scenarios

- Duplicate payment command no duplicate capture
- Stale RC version rejected
- Provider decline saga rematches fulfillment without changing requirement


---

## P2 — Data, Fact Ledger, Evidence & DecisionTrace Architecture

### Purpose

Make every material fact, evidence object, artifact version and decision reconstructable while keeping domain ownership explicit and derived data subordinate.

### Owns

- Logical data ownership map
- FactLedger provenance
- Evidence/object references
- DecisionTrace
- Validity/expiry metadata
- Transactional inbox/outbox/event log persistence
- Derived read/search/warehouse projections

### Explicitly does not own

- Business decisions
- Event transport/backbone (P6)
- One giant cross-domain mutable record
- External-system truth

### Inputs

- All domain writes/events
- Evidence files
- Rule/model/solver refs

### Authoritative outputs

- Authoritative domain records
- Fact lineage
- DecisionTrace
- EvidenceRefs
- Derived read/search models
- Warehouse exports

### Engines / components

- FactLedger Service
- DecisionTrace Service
- Domain Store Adapters
- Inbox/Outbox Store
- Read Model Projectors
- Search Indexer
- Warehouse Exporter
- Object Store Gateway

### Main decision / operating path

1. Domain owner writes authoritative record.
2. Append provenance and transactional outbox atomically.
3. DecisionTrace links input artifact versions, facts, rule release, model/solver refs, reasons/confidence, validity and supersession.
4. P6 transports events; P2 persists source/event lineage where required.
5. Project READ/SEARCH/WAREHOUSE asynchronously.
6. Revalidation triggers fire on expiry/material updates.

### Gates

- Authoritative owner known?
- Expected version valid?
- Evidence provenance present?
- Derived data clearly marked non-authoritative?

### Data objects

- DB-A WorkCase
- DB-B FactLedger
- DB-C Job Architecture
- DB-D Rules & Trust
- DB-E Provider Capability
- DB-F Resources & Partners
- DB-G Fulfillment
- DB-H Commercial/Finance
- DB-I Execution
- DB-J Outcome/Evidence
- DB-K Learning/Analytics
- ID
- OPS
- EVENT
- SEARCH
- READ
- WAREHOUSE
- OBJECT
- DecisionTrace

### Events emitted

- Fact.Appended
- DecisionTrace.Created
- Artifact.Versioned
- Projection.Updated
- Domain.OutboxReady  *(added by ruling: P6 transports what P2 stages; no outbox existed)*
- Data.ProcessingRegistered  *(added by ruling: P8 audits processing it is never told about)*

### Events consumed

- All domain events

### Failure / recovery

- Projection lag → source remains authoritative.
- Index inconsistency → rebuild.
- Object missing → preserve reference/status.
- Schema migration → versioned compatibility.

### Human review

- Source-data correction
- Evidence legal hold
- Privacy deletion exception

### Security / privacy

- Encryption
- Retention/legal hold
- Access audit
- Purpose limitation

### 1M-job scalability

- Partition by domain/WorkCase/region as needed
- CQRS projections
- Derived indexes rebuilt from source/event history

### Non-negotiable invariants

- No giant JobOrder JSON.
- FactLedger does not mean all domain tables collapse into one store.
- Derived read/search/warehouse never outranks source.
- DecisionTrace is first-class.
- Validity/expiry is first-class.
- P6 owns event transport, not P2.

### Integrations / callbacks

- All domain layers
- P1 Orchestrator
- P3 access policy
- P4 observability/analytics


---

## P3 — Identity, Consent & Access

### Purpose

Own logical identity, organization, role, permission, consent and privacy policy for customers, executors, recipients, operators and external partners.

### Owns

- Customer/executor identities
- Organizations
- Roles/permissions
- Third-party recipient authorization
- Consent records
- Session/security context
- Visibility/privacy policies

### Explicitly does not own

- Job planning
- Provider eligibility
- Pricing
- Claims truth
- Financial settlement

### Inputs

- Authentication assertions
- User/org profiles
- Policy rules
- WorkCase/JobOrder role relationships
- Consent requests

### Authoritative outputs

- IdentityContext
- RoleAssignment
- PermissionDecision
- ConsentRecord
- RecipientAccessGrant
- SessionContext
- AuditAccessEvent

### Engines / components

- Identity Resolver
- Org/Role Manager
- Authorization Policy Engine
- Consent Manager
- Recipient Access Controller
- Session Security Service
- Privacy Policy Engine

### Main decision / operating path

1. Authenticate
2. Resolve identity/org/role
3. Evaluate requested action/resource
4. Check consent/recipient grant
5. Issue scoped access context
6. Audit sensitive access
7. Revoke/expire when needed

### Gates

- Identity verified?
- Role permits action?
- Consent valid?
- Recipient access scoped to relevant stop/info?

### Data objects

- Identity
- Organization
- Role
- Permission
- Consent
- AccessGrant
- Session
- AccessAudit

### Events emitted

- Consent.Granted
- Consent.Revoked
- Access.Denied
- Role.Changed
- RecipientGrant.Issued
- Consent.ContextUpdated  *(added by ruling: P3 owns consent grants)*
- Identity.Event  *(added by ruling: P3 owns identity)*
- Identity.ContextResolved  *(added by ruling: L1 cannot open a WorkCase without it)*
- Recipient.Linked  *(added by ruling: recipient scoping is P3's)*

### Events consumed

- WorkCase.Created
- Provider.Accepted
- Recipient.Linked
- Claim.Opened

### Failure / recovery

- Ambiguous recipient identity -> no broad disclosure
- Revoked consent -> remove future access
- Account compromise -> session revoke/security hold

### Human review

- Privilege escalation
- Organization ownership dispute
- High-sensitivity data request

### Security / privacy

- Least privilege
- Purpose limitation
- Data minimization
- Consent provenance
- Session/device security

### 1M-job scalability

- Central logical policy with regional enforcement
- Cache safe authorization data with short TTL
- No auth call should require AI

### Non-negotiable invariants

- Third-party recipients see only relevant information unless explicitly granted more
- Internal operators use role-scoped access
- Advertisers/partners never receive conversation/workcase data outside authorized service purpose

### Integrations / callbacks

- All layers
- P2 data access
- P1 command authorization

### Golden regression scenarios

- Receiver gets stop-specific instructions only
- Provider cannot view unrelated customer history
- Revoked recipient grant takes effect before next read


---

## P4 — Platform Security, Fraud/Abuse & Trust Enforcement Architecture

### Purpose

Protect accounts, transactions, communications and platform operations through cross-cutting security, fraud/abuse controls and incident response without replacing job-specific Trust/Safety rules.

### Owns

- Platform threat/risk signals
- Fraud/abuse detection
- Account/device/session protective controls
- Transaction risk signals
- Runtime security enforcement
- Security incidents
- Cross-layer security holds

### Explicitly does not own

- Job-specific regulatory/rule/qualification authority (L3)
- Identity/AuthN/AuthZ ownership (P3)
- Privacy governance/DSR/retention (P8)
- Commercial/settlement decisions

### Inputs

- P3 identity/session context
- L3 safety/rule events
- P9 payment signals
- P6 telemetry/anomalies
- P7 abuse reports
- All-layer incident signals

### Authoritative outputs

- SecurityDecision
- FraudRiskSignal
- AbuseCase
- ProtectiveControl
- SecurityIncident
- SecurityHold

### Engines / components

- Threat Signal Engine
- Fraud/Abuse Detection
- Risk Scoring Engine
- Protective Control Engine
- Security Incident Manager
- Security Policy Enforcement Gateway

### Main decision / operating path

1. Collect cross-platform security signals.
2. Assess account/device/transaction/communication risk.
3. Apply deterministic security policy and protective controls.
4. Escalate severe/ambiguous cases to security operations.
5. For physical-job safety/legal qualification decisions, call L3 rather than duplicate it.
6. Record security facts/DecisionTrace in P2.

### Gates

- Platform security threat?
- Fraud/abuse threshold?
- Account/session control needed?
- Job-specific safety matter → L3?

### Data objects

- SecurityDecision
- RiskSignal
- ProtectiveControl
- SecurityIncident
- AbuseCase

### Events emitted

- Security.RiskDetected
- Security.ControlApplied
- Fraud.SignalRaised
- Abuse.CaseOpened
- Security.IncidentOpened

### Events consumed

- Identity.Event
- Payment.AuthorizationUpdated
- Message.AbuseReport  *(external: user report, via P7)*
- Telemetry.Anomaly  *(external: infrastructure, via P6)*
- Safety.HoldRaised

### Failure / recovery

- False positive → controlled appeal/review.
- Security system unavailable → fail-safe according to risk class.
- Credential/physical work concern → route L3.

### Human review

- Account suspension/ban
- High-value fraud
- Severe abuse/harassment
- Security incident

### Security / privacy

- Least privilege
- Secrets/KMS
- Tamper-evident logs
- No unnecessary work content

### 1M-job scalability

- Stream risk workers
- Rate/velocity controls
- Regional security operations

### Non-negotiable invariants

- L3 owns job safety/legal/qualification decisions.
- P4 owns platform security/fraud/abuse/runtime protection.
- P3 owns identity/access.
- P8 owns privacy compliance.

### Integrations / callbacks

> Recovered by OCR from the PNG source poster; no SVG exists.
> Source poster uses a unified P1-P14 scheme in which P6=Providers, P8=Task Safety, P9=Messaging, P12=Settlement, P13=Claims and P14=Intelligence. NONE of those match current canon. Remap before use.

- From / To P1 Orchestrator (State, Events)
- From / To P2 Facts (Events, Entities)
- From / To P3 Identity (Identity, Risk Signals)
- From / To L4 (Fulfillment, Matching & Team Assembly) (Profiles, Status)
- From / To L3 (Trust, Safety, Rules & Compliance) (Hazards, Controls)
- From / To P7 (Notifications, Messaging & User Engagement) (Reports, Flags)
- From / To L10 (Live Execution & Change Control) (Problems, State)
- From / To L12 (Settlement, Ledger & Reconciliation) (Chargebacks)
- From / To L13 (Branch, Continuity, Claims & Support) (Safety & Disputes)
- From / To L2 (Intelligence & Planning) (Risk Models)


---

## P5 — Integrations, Connectors & External Services

### Purpose

Securely connect Doneeo to external systems, APIs, data and services with
resilience, observability and governance.

### Owns

- Provide controlled connectivity to external systems
- Normalize, validate and translate external data
- Manage API integrations, webhooks and connectors
- Ensure security, reliability and resilience
- Monitor health, performance and usage
- Enforce data mapping, governance and compliance
- Enable extensibility and ecosystem growth
- Expose and consume APIs securely
- Transform data to Doneeo canonical models
- Manage authentication and authorization
- Handle webhooks, callbacks and event subscriptions
- Provide connector SDKs and integration patterns
- Ensure retries, idempotency and error handling
- Monitor and alert on integration health
- Version and govern external contracts

### Explicitly does not own

- Business logic or decisions (the domain layers L2-L11)
- Data storage or ledger (P2)
- Identity or access (P3)
- Security enforcement (P4)
- Orchestration or state (P1)
- Financial settlement (L12 (Settlement, Ledger & Reconciliation))

### Inputs

- (not specified in source poster — the board states hooks rather than typed inputs; see Integrations / callbacks)

### Authoritative outputs

- IntegrationEvent (02)
- ExternalInteraction (03)
- ConnectorLog (P5)
- AuditLog (P5)

### Engines / components

- Native Connectors — built and maintained by Doneeo
- Certified Connectors — verified third-party
- Community Connectors — open source / community
- Custom Connectors — built for specific needs
- Authentication (OAuth2, API keys, mTLS)
- Rate Limiting — throttle and quota management
- Retry & Backoff — exponential / configurable
- Idempotency — deduplication and keys
- Data Transformation — map and normalize data
- Error Handling — standardized error model
- Fallback & Failover — alternate endpoints
- Observability — logs, metrics, traces

### Main decision / operating path

Integration lifecycle:

1. Discover — identify need and provider
2. Evaluate — assess capability, risk and compliance
3. Design — define data model, flows and contracts
4. Build — implement connector / integration
5. Test — validate, sandbox and certify
6. Deploy — go live with monitoring
7. Monitor — track health, usage and errors
8. Maintain — update, version and improve
9. Review — review, audit and retire

Typical data flow: Doneeo layer or service issues a Request / Command to a P5
connector, which calls the external service or API; the External Response / Data
returns through the connector, and a Callback / Webhook / Event may arrive
asynchronously and re-enter through P5.

### Gates

- (not specified in source poster — this board carries no decision-gate section)

### Data objects

- IntegrationEvent (02)
- ExternalInteraction (03)
- ConnectorLog (P5)
- AuditLog (P5)
- Reports & Analytics (14)

External system categories the layer integrates:

- Maps & Location — Google Maps / Places, Routing / Distance, Geocoding / Reverse Geocoding, Traffic / ETA, Address Validation
- Payments & Financial — Payment Gateways (PSP), Banking / Open Banking, Payouts / Transfers, Fraud / Risk Services, Currency / FX Services
- Communication — Email Services (SendGrid), SMS / OTP (Twilio), Push Notifications (FCM / APNs), Chat / Messaging, Voice / Call Services
- Identity & Verification — ID Verification (Onfido / Trulioo), Document Verification, Biometric / Liveness, Address Verification, KYC / AML Providers
- Storage & Files — Cloud Storage (S3 / GCS / Azure), CDN (CloudFront / Cloud CDN), Image / Video Processing, File Conversion / OCR, Backup / Archive Services
- Logistics & Transport — Courier / Delivery APIs, Fleet / Vehicle APIs, Shipping Rate Providers, Tracking APIs, Route Optimization
- Insurance & Safety — Insurance Verification, Policy Management, Claims APIs, Safety Data Providers, Background Checks
- Government & Regulatory — Business Registry, Tax / VAT / GST APIs, License Verification, Sanction / Watchlist, Compliance Databases

Integration patterns: REST / HTTPS APIs · GraphQL APIs · Webhooks (inbound / outbound) · Event Streaming (Pub / Sub) · Polling / Scheduled Sync · File / SFTP / Batch · SDK / Library Integration · Message Queues

### Events emitted

- (not specified in source poster — no events section on this board)

### Events consumed

- (not specified in source poster — no events section on this board)

### Failure / recovery

- Timeouts & circuit breakers
- Retry policies
- Bulkheads & isolation
- Queue buffering
- Dead letter handling
- Graceful degradation
- Disaster recovery
- Standard error model
- Error classification
- User-friendly messages
- Automatic retries
- Manual resolution flow
- Escalation rules
- Root cause tracking

### Human review

- (not specified in source poster — the board lists a manual resolution flow and approval workflow but no human-review triggers)

### Security / privacy

- Secure transport (TLS 1.2+)
- Secrets management (Vault / KMS)
- Least privilege access
- Data minimization
- PII / sensitive data controls
- Compliance monitoring
- Audit logging

### 1M-job scalability

- Health checks
- Metrics & dashboards
- Alerting & notifications
- Distributed tracing
- Log aggregation
- Usage analytics
- SLA / SLI monitoring

### Non-negotiable invariants

Integration principles, as printed:

- Standardized — use open standards and contracts
- Observable — monitor, log and trace
- Secure by Default — AuthN, AuthZ, encryption
- Governed — approved, versioned, audited
- Resilient & Reliable — retries, timeouts, fallbacks
- Extensible — easy to plug and scale
- Loose Coupling — async first, event-driven
- Data Quality — validate, map, reconcile
- P5 writes immutable integration facts to P2

Governance and lifecycle controls: contract versioning · change management ·
deprecation policy · documentation · approval workflow · periodic review ·
retirement process

Data mapping and transformation: field mapping · data type conversion ·
normalization · validation and cleansing · enrichment · deduplication ·
canonical alignment

### Integrations / callbacks

- From P1 (Orchestrator) — Command / Event Integration
- From P2 (Ledger / Events) — Events / Facts Integration
- From P3 (Identity / Access) — AuthN / AuthZ Integration
- From P4 (Security / Safety) — Risk / Policy Integration
- From L2 (Intelligence & Planning) — External Data / APIs
- From L10 (Live Execution & Change Control) — Status / Tracking / ETA
- From L11 (Outcome, Completion & Evidence) — Evidence / Reports
- From L12 (Settlement, Ledger & Reconciliation) — Payment / Payout / Tax
- From L13 (Branch, Continuity, Claims & Support) — Evidence / Case Data
- From L2 (Intelligence & Planning) — Insights / Enrichment

### Golden regression scenarios

- (none — this board predates the golden-scenario template and carries no such section)


---

## P6 — Event Backbone, Model Gateway, Observability & 1M-Job Scale Architecture

### Purpose

Provide reliable event transport, scalable worker execution, model routing and full observability while keeping AI off authoritative hard-rule/state decisions.

### Owns

- Event/message backbone
- Worker pools
- Model Gateway
- Telemetry/observability
- Caches/read infrastructure
- Reliability patterns
- Regional scaling/deployment evolution

### Explicitly does not own

- Business decisions
- Rule authority
- Primary domain storage
- Identity/security policy
- Final financial truth

### Inputs

- Domain outbox events
- Commands/queues
- Model requests
- Metrics/logs/traces
- Regional config

### Authoritative outputs

- Event streams
- Worker queues
- ModelInvocationRef
- Metrics/traces/alerts
- DLQ/retry state

### Engines / components

- Event Backbone
- Schema Registry
- Planning Workers
- Rules Workers
- Fulfillment Workers
- Execution/Reality Workers
- Commercial/Finance Workers
- Outcome Workers
- Model Gateway
- Observability Stack
- Cache/Read Infrastructure
- Regional Config Service

### Main decision / operating path

1. P1/domain writes transactional outbox.
2. P6 transports at-least-once events to idempotent consumers.
3. Worker pools scale independently by domain load.
4. Model Gateway selects provider/model based on capability, risk, latency and cost; outputs advice/structured reasoning refs.
5. Deterministic domain validates model outputs before authority.
6. Observability tracks SLOs and cross-layer traces.
7. Bulkhead Execution/Payment from AI/Analytics.
8. Scale physically only when measured load justifies separation.

### Gates

- AI required on critical path? minimize/avoid where deterministic path exists.
- Queue saturation? autoscale/bulkhead.
- Model provider failure? fallback/defer noncritical reasoning.
- Regional failure? failover policy.

### Data objects

- EventEnvelope
- QueueMessage
- ModelInvocationRef
- Metric
- Trace
- Alert
- DLQItem
- RegionalConfig

### Events emitted

- Event.Delivered
- ModelInvocation.Completed
- Operational.AlertRaised
- DLQ.ItemCreated

### Events consumed

- Domain.OutboxReady
- All operational telemetry

### Failure / recovery

- Duplicate delivery → idempotent consumer.
- Poison event → DLQ.
- AI outage → deterministic core continues where possible.
- Search/read outage → slower authoritative path.

### Human review

- Regional failover
- SLO breach
- Model outage affecting material workflow
- Security incident

### Security / privacy

- PII-safe telemetry
- Service identity
- Secrets isolation
- Regional data policy

### 1M-job scalability

- Stage 1: modular monolith + relational DB + background workers.
- Stage 2: horizontal workers/event backbone/read models.
- Stage 3: selected service extraction from measured hotspots.
- Stage 4: multi-region partitioning/domain stores for sustained high load.
- Target is 1M+ jobs/month logical architecture, not a promise of 1M concurrent jobs.

### Non-negotiable invariants

- AI reasons/recommends; deterministic code/rules/state/versioning are authority.
- No mandatory multi-model consensus.
- Learning may propose, never auto-publish compliance rules.
- Scale changes HOW, not WHAT.
- Million-job logical architecture now; million-job physical infrastructure when load requires it.

### Integrations / callbacks

- P1 Orchestrator
- P2 Data
- All layers


---

## P7 — Notifications, Messaging & User Engagement

### Purpose

Orchestrate intelligent, contextual and reliable communication across the Doneeo
ecosystem — the right message, to the right person, at the right time, on the
right channel.

### Owns

- Deliver timely, relevant and actionable messages
- Engage users across the journey
- Support transactional and conversational messaging
- Personalize by context, role and preference
- Ensure reliability, delivery and compliance
- Provide user communication preferences
- Measure engagement and message effectiveness
- Route messages to the right channel
- Personalize content by context and profile
- Trigger messages from events and workflows
- Support two-way conversations
- Manage templates, localization and rendering
- Handle delivery, retries and fallbacks
- Track delivery, opens, clicks and replies
- Support escalation and urgent alerts

### Explicitly does not own

- Business or orchestration decisions (the domain layers L1-L11)
- Data storage or identity (P2 (Data & FactLedger) and P3 (Identity))
- Security enforcement (P4)
- Financial transactions (L12 (Settlement, Ledger & Reconciliation))
- State or truth (P2) or orchestration (P1)

### Inputs

Message context sources:

- WorkCase / Job State
- User Profile & Preferences
- Location & Time
- Device & Channel
- Behavior & History
- Risk & Safety Signals
- AI Insights & Predictions
- External Systems
- Business Rules
- Seasonality & Trends

### Authoritative outputs

- MessageEvent (02)
- MessageDelivery (03)
- MessageEngagement (04)
- UserPreferences (05)
- OptInConsent (06)

### Engines / components

- Message Orchestration — event-driven triggers, workflow-based messages, journey orchestration, sequencing & throttling, conditional logic, A/B message variants
- Template & Content Management — reusable templates, dynamic content, localization & translation, versioning & approvals, branding & theming, rich content support
- Personalization & Targeting — user profile & preferences, role-based targeting, contextual personalization, behavior-based targeting, geographic & time-based, segmentation & audiences
- Delivery & Routing — channel selection, priority routing, delivery optimization, retry & fallback, rate limiting, carrier & provider management
- Conversations & Replies — two-way messaging, threading & context, quick replies, human handoff, auto-responders, conversation history
- Preferences & Control — channel preferences, frequency control, quiet hours, opt-in / opt-out, topic subscriptions, preference center
- Analytics & Engagement — delivery status, open / read / click, reply & response rate, conversion tracking, engagement scoring, campaign performance
- Compliance & Safety — SPAM / abuse prevention, content filtering, PII & data protection, legal compliance, retention policies, audit & logging

### Main decision / operating path

Message flow, typical path:

1. Event / Trigger — from any layer
2. Message Decision — orchestration
3. Audience & Preference — targeting
4. Template & Content — render
5. Channel Selection — routing
6. Delivery — send
7. User Receives — read / interact
8. User Action / Reply — optional
9. Track & Capture — events
10. Analytics & Insights — measure
11. Feedback Loop — optimize

Failed sends re-enter at Failed / Retry / Fallback. Replies and interactions
re-enter as Reply / Interaction. The measure step feeds Learn & Optimize back
into orchestration.

### Gates

- (not specified in source poster — this board carries no decision-gate section)

### Data objects

- MessageEvent (02)
- MessageDelivery (03)
- MessageEngagement (04)
- UserPreferences (05)
- OptInConsent (06)
- Reports & Analytics (14)

Message types: Transactional (receipts, confirmations) · Operational (updates,
status) · Marketing (promotions, offers) · System (alerts, maintenance) · Safety
(warnings, emergencies) · Conversational (chat, replies) · Engagement (tips,
nudges) · Survey / Feedback · Billing & Payment · Escalation / High Priority

Channels: In-App Inbox · Push Notifications · Email · SMS / OTP · Voice / Call ·
WhatsApp / RCS · Web Chat · Provider / Executor App · Web Dashboard · External
Webhooks · API to Partner Systems

Delivery states: Queued · Sending · Sent · Delivered · Read / Opened ·
Clicked / Engaged · Replied · Failed · Bounced · Suppressed · Unsubscribed

User journeys supported: Onboarding & Welcome · Job Lifecycle Updates ·
Provider / Executor Updates · Payment & Billing · Safety & Compliance ·
Reminders & Deadlines · Promotions & Offers · Surveys & Feedback ·
Escalations & Alerts · Re-engagement

### Events emitted

- (not specified in source poster as a typed event list; the board models delivery states rather than domain events)

### Events consumed

- (not specified in source poster; triggers arrive as "Event / Trigger — from any layer")

### Failure / recovery

- Auto retry & backoff
- Fallback channels
- Rate limiting
- Concurrency control
- Circuit breaker
- Idempotency
- Failed / Retry / Fallback re-entry into the message flow

### Human review

- Human handoff from a conversation
- Content approval
- (no further human-review triggers specified in source poster)

### Security / privacy

- Data Privacy (GDPR, PIPEDA)
- Consent Management
- Message Audit Trail
- Content Approval
- Retention & Deletion
- Accessibility (WCAG)
- Language & Localization
- Legal Disclaimers
- CAN-SPAM / CASL
- Policy Enforcement
- PII & data protection
- SPAM / abuse prevention

### 1M-job scalability

- High delivery success
- Low latency
- Bulk sending optimization
- Provider health monitoring
- Concurrency control
- Rate limiting

Engagement metrics tracked: Delivery Rate · Open Rate · Click Through Rate (CTR) ·
Reply Rate · Conversion Rate · Unsubscribe Rate · Spam Report Rate · Time to
First Interaction · Engagement Score · Journey Completion Rate

### Non-negotiable invariants

Communication principles, as printed:

- Relevant — context-aware messages
- Timely — right time, not too much
- Personalized — user, role and context
- Actionable — clear call to action
- Reliable — deliver or retry
- Respectful — user preferences first
- Two-Way — listen and respond
- Inclusive — accessible and localized
- Compliant — legal and policy aligned
- Measurable — track and improve
- P7 writes communication facts to P2

### Integrations / callbacks

- From P1 (Orchestrator) — Events / Commands
- From P2 (Ledger) — Facts / State Changes
- From P3 (Identity) — User / Role / Profile
- From P4 (Security) — Alerts / Restrictions
- From P5 (Integrations) — External Events
- From P6 (AI / Observability) — Insights
- To Channels / Providers — Delivery APIs
- To Analytics / Warehouse — Engagement Data

### Golden regression scenarios

- (none — this board predates the golden-scenario template and carries no such section)


---

## P8 — Privacy, Data Governance & Regulatory Compliance Architecture

### Purpose

Govern lawful data use, privacy-by-design, classification, data lifecycle, data-subject rights and compliance assurance without duplicating identity or runtime security ownership.

### Owns

- Privacy policy
- Data classification/handling rules
- Privacy impact assessments/DPIA
- Data subject rights
- Retention/legal hold/disposal
- Records of processing
- Privacy compliance assurance

### Explicitly does not own

- Authentication/authorization/session identity (P3)
- Runtime security/fraud enforcement (P4)
- Primary data storage (P2)
- Business decisions
- Financial settlement

### Inputs

- P3 identity/consent-grant context
- P2 data catalog/lineage
- All-layer data processing inventory
- P5 third-party contracts
- P6 telemetry
- Jurisdictional requirements

### Authoritative outputs

- PrivacyPolicy
- DataClassification
- ProcessingPurpose
- RetentionPolicy
- DSRCase
- DPIA
- ComplianceFinding

### Engines / components

- Privacy Policy Engine
- Data Classification Service
- Processing Inventory/RoPA
- DSR Workflow
- Retention/Legal Hold Manager
- DPIA/Risk Assessment
- Compliance Monitoring/Audit

### Main decision / operating path

1. Classify data and lawful purpose.
2. Apply minimization/purpose/retention rules.
3. P3 enforces actual access/consent grants; P8 defines privacy requirements.
4. P4 enforces runtime security controls; P8 verifies privacy/compliance controls.
5. Process DSR requests against P2 authoritative stores.
6. Apply legal holds/retention/disposal with audit evidence.
7. Assess third-party/cross-border processing.

### Gates

- Lawful basis/purpose?
- Data minimization satisfied?
- Retention/legal hold conflict?
- DSR identity verified by P3?
- Cross-border/third-party review required?

### Data objects

- PrivacyPolicy
- DataClassification
- ConsentRequirement
- DSRCase
- RetentionAction
- DPIA
- AuditEvidence

### Events emitted

- Privacy.PolicyUpdated
- DSR.Opened
- Retention.Actioned
- Compliance.FindingRaised

### Events consumed

- Data.ProcessingRegistered
- Consent.ContextUpdated
- Security.IncidentOpened
- Integration.ContractUpdated  *(external: operations)*

### Failure / recovery

- DSR conflict/legal hold → compliance review.
- Unknown processing purpose → block/limit.
- Third-party noncompliance → restrict integration.

### Human review

- High-risk DPIA
- Regulator/audit request
- Legal hold conflict
- Cross-border exception

### Security / privacy

- Privacy by design
- Purpose limitation
- Minimization
- Transparency
- Retention discipline

### 1M-job scalability

- Policy caching
- Async inventory/audit
- Region-specific rule packs

### Non-negotiable invariants

- P3 owns identity/access/consent grants; P8 owns privacy policy and data lifecycle.
- P4 owns runtime security enforcement.
- P2 owns authoritative data/evidence stores.
- Privacy controls apply across all domain layers.

### Integrations / callbacks

> Recovered by OCR from the PNG source poster; no SVG exists.
> Source poster's platform numbering matches current canon (P4=Security, P6=Event/AI/Observability, P7=Messaging, P9=Finance) except P10=Execution, which canon owns as domain layer L10.

- From P1 (Orchestrator)
- From P2 (Ledger / Data)
- From P3 (Identity)
- From P4 (Security & Safety)
- From P6 (Event, AI, Obs.)
- From P7 (Messaging)
- From L12 for settlement truth, P9 for rails only
- From L10 (Live Execution & Change Control)


---

## P9 — Payment Rails, Tax/Financial Adapters & Treasury Integrations Architecture

### Purpose

Execute controlled external financial rail operations for PSPs, banks, payouts, tax and FX under instructions from authoritative commercial/settlement layers.

### Owns

- Payment-method token/reference boundary
- PSP authorization/capture/refund/void adapter calls
- Payout/bank transfer rails
- Tax-provider/remittance adapters
- FX/provider adapters
- Financial webhook normalization
- Rail-level retries/idempotency/status

### Explicitly does not own

- Pricing/fees/customer offer (L6)
- Final settlement allocation/customer charge/provider payable (L12/09B)
- Authoritative ledger/reconciliation (L12)
- Fraud/security policy (P4)
- Generic connector framework (P5)

### Inputs

- PaymentTopologyPolicy/ContractRoleProfile refs
- Idempotent FinancialCommand from L12
- P3 payer/payee identity refs
- P4 fraud/security clearance
- P5 connector transport primitives

### Authoritative outputs

- FinancialRailResult
- AuthorizationRef
- CaptureRef
- RefundRef
- PayoutRef
- TaxRailResult
- FXQuoteRef
- NormalizedFinancialWebhook

### Engines / components

- PSP Adapter Gateway
- Payment Method Token Service
- Authorization/Capture Adapter
- Refund/Void Adapter
- Payout/Bank Adapter
- Tax/Remittance Adapter
- FX Adapter
- Webhook Normalizer
- Rail Retry/Idempotency Controller

### Main decision / operating path

1. Receive signed/idempotent command from L12.
2. Resolve PaymentTopologyPolicy adapter path without changing business allocation.
3. Execute PSP/bank/tax/FX operation.
4. Normalize callback/webhook and correlate to command.
5. Return rail result/status to L12.
6. L12 posts ledger and performs authoritative reconciliation.
7. P4 handles fraud/security signals; P8 handles privacy/compliance requirements; P5 provides generic external-connector patterns.

### Gates

- Command authorized/idempotent?
- Adapter/rail available?
- Token/reference valid?
- External result conclusive?
- Retry safe?

### Data objects

- FinancialCommand
- FinancialRailResult
- PaymentMethodTokenRef
- PSPWebhook
- BankTransferRef
- TaxRemittanceRef
- FXQuoteRef

### Events emitted

- Rail.CommandAccepted
- Rail.ResultReceived
- Rail.CallbackNormalized
- Rail.Failed

### Events consumed

- Settlement.FinancialCommand
- PSPWebhookReceived
- BankCallbackReceived

### Failure / recovery

- Timeout → query/retry with idempotency.
- Unknown callback → quarantine/manual review.
- Provider outage → alternate rail only if PaymentTopologyPolicy permits.
- Never infer success from timeout.

### Human review

- High-value manual transfer
- Unknown external status
- Compliance/rail exception

### Security / privacy

- Tokenize/minimize PCI data
- No raw credentials in domain stores
- Secrets vault
- Signed webhooks

### 1M-job scalability

- Adapter workers horizontally scalable
- Per-rail bulkheads
- Circuit breakers/rate limits

### Non-negotiable invariants

- L6 owns price; P9 does not.
- 09B owns responsibility allocation; P9 does not.
- L12 owns final settlement, ledger and reconciliation; P9 only executes external rail commands and returns evidence.
- P5 owns generic connector framework; P9 owns financial-domain adapter semantics.

### Integrations / callbacks

> Recovered by OCR from the PNG source poster; no SVG exists.
> Source poster's platform numbering matches current canon.

- From P1 (Orchestrator)
- From P2 (Ledger / Data)
- From P3 (Identity)
- From P4 (Security & Safety)
- From P6 (Event, AI, Obs.)
- From P7 (Messaging)


---

## 9 · Golden regression scenarios

57 assertions, three per board across 18 boards. Every reconciled spec
had dropped them; they are the only executable content the architecture ever
had. Live at `tests/architecture-scenarios.test.ts`.

P5 and P7 have none — their boards predate this template, so theirs must be
written rather than recovered.

| id | layer | scenario |
|---|---|---|
| `L1-G1` | L1 | Multi-part request preserved as one WorkCase |
| `L1-G2` | L1 | Third-party recipient captured without over-sharing |
| `L1-G3` | L1 | Duplicate submit does not duplicate WorkCase |
| `L2-G1` | L2 | Ground-floor statement suppresses irrelevant elevator question |
| `L2-G2` | L2 | Multi-task sentence creates distinct TaskBlocks |
| `L2-G3` | L2 | Field fact changes one TaskBlock without rebuilding unrelated tasks |
| `L2-G4` | L2 | Requirement Contract remains provider-neutral |
| `L3-G1` | L3 | Licensed trade requires qualified provider |
| `L3-G2` | L3 | Credential expires after booking before dispatch |
| `L3-G3` | L3 | Field discovery changes regulatory classification |
| `L4-G1` | L4 | Two-person minimum never reduced to one because of scarcity |
| `L4-G2` | L4 | Provider decline rematches only fulfillment |
| `L4-G3` | L4 | No slot at requested time yields alternative feasible times |
| `L5-G1` | L5 | Customer owns required drill so no rental |
| `L5-G2` | L5 | Team member asset closes true gap |
| `L5-G3` | L5 | On-site missing fitting triggers resource recovery and actual receipt |
| `L6-G1` | L6 | Expired rental quote forces offer refresh |
| `L6-G2` | L6 | Budget/recommended options differ in real feasible configuration |
| `L6-G3` | L6 | Payment topology selected by contract role profile |
| `L7-G1` | L7 | Two-person accepted job creates two role reservations |
| `L7-G2` | L7 | Cancellation shortly before start triggers backfill before lost-capacity calculation |
| `L7-G3` | L7 | Reschedule keeps same team when feasible |
| `L8-G1` | L8 | Accepted provider credential expires before start |
| `L8-G2` | L8 | Rental confirmation missing triggers resource recovery |
| `L8-G3` | L8 | Ground-floor access confirmed and irrelevant elevator check suppressed |
| `L09A-G1` | L09A | R2 missing tool resolved without RC change |
| `L09A-G2` | L09A | R3 incompatible connection produces RC vN+1 only for affected task |
| `L09A-G3` | L09A | R5 unrelated faucet repair remains CandidateFollowUp |
| `L09B-G1` | L09B | Two-person blocked job computes protection per role |
| `L09B-G2` | L09B | Customer inaccurate known fact causes eligible disruption charge but not full job price |
| `L09B-G3` | L09B | Doneeo planning error -> provider protected, customer not charged incremental error cost |
| `L10-G1` | L10 | Delay changes ETA without RC change |
| `L10-G2` | L10 | Hidden condition triggers 09A |
| `L10-G3` | L10 | Provider handoff preserves context and evidence |
| `L11-G1` | L11 | Completed installation fails completion criterion -> remediation |
| `L11-G2` | L11 | Customer unavailable but evidence proves completion |
| `L11-G3` | L11 | Follow-up suggestion does not keep JobOrder open |
| `L12-G1` | L12 | Provider paid while Doneeo absorbs planning error |
| `L12-G2` | L12 | Unused authorization released after partial close |
| `L12-G3` | L12 | Lost callback replay causes no duplicate financial effect |
| `L13-G1` | L13 | Prerequisite electrical correction blocks only install |
| `L13-G2` | L13 | TaskBlock |
| `L13-G3` | L13 | Unrelated faucet becomes follow-up only after customer consent |
| `L13-G4` | L13 | Damage claim issues financial remedy via L12 without rewriting |
| `L13-G5` | L13 | Outcome |
| `P1-G1` | P1 | Duplicate payment command no duplicate capture |
| `P1-G2` | P1 | Stale RC version rejected |
| `P1-G3` | P1 | Provider decline saga rematches fulfillment without changing requirement |
| `P2-G1` | P2 | Provider license expiry triggers revalidation |
| `P2-G2` | P2 | Fact update preserves superseded value |
| `P2-G3` | P2 | Search index stale but authoritative eligibility recheck prevents bad match |
| `P3-G1` | P3 | Receiver gets stop-specific instructions only |
| `P3-G2` | P3 | Provider cannot view unrelated customer history |
| `P3-G3` | P3 | Revoked recipient grant takes effect before next read |
| `P6-G1` | P6 | Model provider outage during execution |
| `P6-G2` | P6 | 1M/mo matching uses derived index + authoritative recheck |
| `P6-G3` | P6 | Lost callback replay remains idempotent |

---

## Provenance

Built from 41 extracted poster boards, 19 HTML layer documents, the 11 v2.1
reconciled specs, and two boards found only in the figma folder — an L11 v1.2
board carrying the outcome state machine, and a P1 board carrying the
orchestration principles, neither of which appears in either release package.

The SVG extraction was validated against OCR of the same board: zero misses.
The HTML documents were diffed against the posters: 3–4 differing lines each,
all boilerplate.

Three self-certifying QA artifacts were found and are not relied on here —
v1.2's `VALIDATION_REPORT.json` (string-presence checks, every detail field
empty, `overall_pass: true`), v2.1's Coherence QA (checks that the edits it made
were made), and the `SELF-REVIEW PASS` boilerplate identical on 14 boards. None
has ever failed anything. The checks behind §5 of this document can fail, and
did, 52 times before the rulings were applied.

