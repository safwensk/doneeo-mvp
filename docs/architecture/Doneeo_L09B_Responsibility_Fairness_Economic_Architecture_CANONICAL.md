# L09B — Responsibility & Fairness Economic Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Determine fair economic consequences using evidence, causality and policy while keeping provider protection, customer liability and Doneeo absorption independent.

## Owns
- Causality classification
- Customer/provider/Doneeo/external responsibility tests
- Capacity-loss input after recovery
- Provider Protected Payable
- Customer Reality Adjustment
- Doneeo Absorption / Recovery Credit
- AdjustmentInstruction
- Responsibility DecisionTrace

## Explicitly does not own
- Weighted blame scoring
- Pricing new work (L6)
- Final capture/refund/ledger (L12)
- Claims appeal adjudication (L13)
- Safety authority (L3)

## Inputs
- RealityCase/recovery path (09A)
- Changed facts/evidence
- Fact Ledger/question history
- ScopeContract
- Provider obligations/preparation
- CapacityReservation + CapacityRecoveryAttempt (L7)
- CommercialDelta price (L6)
- Actual resource receipts

## Authoritative outputs
- ResponsibilityAssessment
- ProtectedProviderPayable
- CustomerRealityAdjustment
- DoneeoAbsorption
- RecoveryCredit
- AdjustmentInstruction

## Engines / components
- Causality Classifier
- Responsibility Policy Engine
- Customer Material-Fact Test
- Provider Obligation/Performance Test
- Doneeo Control/Planning Test
- Provider Protection Engine
- Capacity Loss Calculator
- Customer Adjustment Engine
- Doneeo Absorption/Credit Engine

## Main decision / operating path
1. Classify canonical cause taxonomy.
2. Test customer responsibility: material fact + Doneeo asked/disclosed importance + customer could reasonably know + inaccurate/omitted + causal link; if Doneeo reasonably should have asked but did not, customer responsibility is not presumed.
3. Assess provider responsibility from obligation, preparation and performance evidence.
4. Assess Doneeo responsibility from planning/system/marketplace control.
5. Consume L7 capacity-recovery result before net lost-capacity calculation.
6. Calculate PPP per assigned role/person/resource: preparation + mobilization + actual work/diagnosis + net lost reserved capacity + eligible external costs.
7. Use L6 price for approved revised work; 09B allocates economic responsibility, it does not price.
8. Calculate customer adjustment only from evidence-backed responsibility/approved work/resources minus credits/unperformed amounts.
9. Calculate Doneeo/partner absorption and Recovery Credit.
10. Routine clear cases deterministic; high-value/disputed/mixed/undetermined → human/L13.
11. Send approved instruction to L12.

## Gates
- Evidence sufficient?
- Customer material-fact test established?
- Provider protection eligibility?
- High-value/disputed/mixed/undetermined cause?
- Policy exception?

## Data objects
- ResponsibilityAssessment
- ProtectedProviderPayable
- CustomerRealityAdjustment
- DoneeoAbsorption
- RecoveryCredit
- AdjustmentInstruction
- EvidenceBundleRef
- DecisionTrace

## Events emitted
- Responsibility.Assessed
- ProviderProtection.Calculated
- CustomerAdjustment.Calculated
- RecoveryCredit.Applied
- AdjustmentInstruction.Approved

## Events consumed
- RealityCase.RecoveryPathSelected
- CapacityRecovery.Completed
- CommercialDelta.Priced
- Outcome.ActualsAvailable
- Cancellation.Requested

## Failure / recovery
- Insufficient evidence → no automatic customer blame.
- Mixed cause → policy allocation without weighted score overriding hard rules.
- Dispute → L13.
- Payment failure → L12/P9 FinanceOps path.

## Human review
- High-value impact
- Disputed causality
- Appeal
- Potential fraud/abuse

## Security / privacy
- No public blame labels.
- Evidence/rationale access scoped.
- Provider private economics protected.

## 1M-job scalability
- Deterministic policy evaluation
- Per-role PPP parallel calculation
- Analytics separated from authoritative assessment

## Non-negotiable invariants
- NO weighted blame engine.
- PPP ≠ customer liability ≠ Doneeo absorption.
- Doneeo planning error does not become customer surcharge.
- Hidden condition alone does not create customer liability.
- Customer declining revised work does not make revised job/full original price automatically owed.

## Supersedes / preserves
Supersedes all 09B contribution-percentage/scoring variants. Preserves the recovered v1.3 causality/material-fact/PPP-CRA-DAC architecture with terminology tightened.

## Special control — CAUSALITY & THREE-WAY ECONOMIC FAIRNESS

- Causality
- Hidden condition; customer inaccurate/omitted fact; customer scope change; Doneeo planning error; provider prep/execution failure; resource/partner failure; external; safety/regulatory; mixed; undetermined.
- Customer responsibility test
- Material fact? Doneeo asked/disclosed?
- Customer could reasonably know?
- Inaccurate/omitted? Causal link? Did Doneeo ignore contradictory evidence?
- Provider Protected Payable
- Preparation + mobilization + actual work/diagnosis + net lost reserved capacity after backfill + eligible external costs.
- Calculate per role/person.
- Customer Reality Adjustment
- Completed/approved work + eligible customer- responsible disruption/resources − credits − unperformed amounts.
- Doneeo Absorption / Recovery Credit
- Platform share for Doneeo/marketplace risk, partner responsibility, retention or policy- defined recovery.
- NO weighted blame engine. Responsibility = evidence + causality + policy. Provider payable, customer liability and Doneeo absorption are never forced to be equal.

## Integrations / callbacks

- L09A Reality
- L7 Cancellation
- L12 Settlement
- L13 Claims
- L3 Trust/Safety where required

