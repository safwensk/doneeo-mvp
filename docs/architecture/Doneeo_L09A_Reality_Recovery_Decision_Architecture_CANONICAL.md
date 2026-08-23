# L09A — Reality & Recovery Decision Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Reconcile the approved plan with physical reality and find the fastest safe recovery path while preserving unaffected work and authority boundaries.

## Owns
- RealityCase
- Field evidence + Field MSI
- Fact Ledger field updates
- Semantic R0–R5 impact classification
- Dependency impact analysis
- Safety interrupt routing
- Fastest-safe-solution hierarchy
- Targeted reanalysis coordination
- Resume/branch/partial-close decision

## Explicitly does not own
- Responsibility/economic allocation (09B)
- Pricing revised work (L6)
- Final cancellation settlement (L7/L12)
- Final outcome truth (L11)

## Inputs
- RequirementContract
- WorkPlan
- Execution state
- Field observations/photos/measurements
- Current rules
- Provider/resource availability

## Authoritative outputs
- RealityCase
- ChangedFact
- FieldMSI
- ImpactClassification
- RecoveryDecision
- TargetedReanalysisRequest
- BranchRequest
- ResumeDecision

## Engines / components
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

## Main decision / operating path
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

## Gates
- R0 Confirmed as planned
- R1 Minor operational variance
- R2 Fulfillment/resource variance
- R3 Requirement-impacting condition
- R4 Safety/regulatory change
- R5 Independent new work

## Data objects
- RealityCase
- ChangedFact
- FieldMSI
- ImpactClassification
- RecoveryOption
- RecoveryDecision
- BranchRelationshipRequest
- DecisionTrace

## Events emitted
- RealityCase.Created
- FactLedger.FieldUpdated
- RecoveryOption.Selected
- TargetedReanalysis.Requested
- Branch.Requested
- Execution.ResumeRequested

## Events consumed
- Execution.IssueDetected
- Provider.FieldObservation
- Customer.FieldUpdate
- SafetySignal.Raised

## Failure / recovery
- Unsafe condition → immediate smallest-safe-scope hold.
- No resource solution → expand L4/L5 search.
- Cannot isolate impact → full replan last resort.
- No safe/viable recovery or customer declines → L7 cancellation path.

## Human review
- R4 safety/regulatory
- High-impact ambiguous reality
- Major scope/cost/time change
- Disputed field facts

## Security / privacy
- Evidence tied to WorkCase/TaskBlock.
- Executor submits facts, not blame or self-priced changes.
- Field evidence immutable by reference.

## 1M-job scalability
- Low-latency Field MSI
- Affected-node reanalysis
- Parallel recovery search
- WorkCase ordered events

## Non-negotiable invariants
- R0–R5 are semantic classes, NOT severity.
- Physical reality is authoritative but cannot bypass controls.
- Solution before broad replanning.
- Continue unaffected TaskBlocks when dependencies/safety allow.
- Full replan and cancellation are last resort.

## Supersedes / preserves
Supersedes all 09A variants that encode R0–R5 as severity/no-impact→unsafe. Preserves their evidence, RealityCase and recovery mechanics.

## Integrations / callbacks

- L2 Intelligence
- L3 Trust/Safety
- L4 Fulfillment
- L5 Resources
- L7 Cancellation last resort
- L09B Fairness
- L10 Execution
- P2 Fact Ledger

