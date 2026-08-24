# L2 — Intelligence & Planning

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_02_INTELLIGENCE_PLANNING_ENGINE_ARCHITECTURE_FULL_DETAIL_v1.2_A.txt (Board A) + Doneeo_02_INTELLIGENCE_PLANNING_ENGINE_ARCHITECTURE_FULL_DETAIL_v1.2_B.txt (Board B)

## Purpose
Transform a messy physical-work problem into a complete, versioned Requirement Contract based on facts, minimal sufficient information, explicit assumptions and measurable completion criteria.

## Owns
- Problem understanding
- Task decomposition
- Global pre-analysis
- Fact resolution
- MSI and question strategy
- TaskGraph architecture
- Abstract resource planning
- Time/route/cost estimation
- Completion Specification
- Architecture simulation
- Requirement Contract compilation

## Explicitly does not own
- Provider matching/availability
- Commercial offer/pricing
- Final rule authority
- Payment/settlement
- Execution truth/outcome

## Inputs
- WorkCase and objective
- Fact Ledger/evidence
- Context/location/timing/access
- Rules metadata
- Service/task primitive library
- Historical calibration data

## Authoritative outputs
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

## Engines / components
- E1 P1 Semantic Interpreter
- E2 P2 Candidate Task Decomposer
- E3 P3 Global Pre-analysis
- E4 P4 Fact Resolver
- E5 P5 Primitive & Task Architect
- E6 P6 Dependency / TaskGraph Engine
- E7 P7 MSI / Gap / Evidence Resolver
- E8 P8 Question Orchestrator
- E9 P9 Abstract Resource Planner
- E10 P10 Time / Route / Cost Estimator
- E11 P11 Completion Specification Engine
- E12 P12 Scenario / Constraint Optimizer
- E13 P13 Architecture Simulator
- E14 P14 Risk-Based Quality Checker
- E15 P15 Requirement Compiler

## Main decision / operating path
1. Semantic interpretation
2. Candidate task decomposition
3. Global pre-analysis for shared facts/dependencies
4. Fact resolution to authoritative Fact Ledger
5. MSI check
6. Ask only targeted missing questions; deterministic per-answer update loop
7. Build TaskGraph and primitives
8. Plan abstract resources
9. Estimate time/route/cost
10. Define completion specification
11. Generate scenarios
12. Architecture simulation
13. Risk-based quality challenge
14. Compile Requirement Contract vN

## Gates
- MSI cleared or explicit assumption accepted?
- Architecture feasible independent of supply?
- Hard constraints satisfied?
- Risk requires independent checker/human?
- Requirement Contract internally consistent?

## Data objects
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

## Events emitted
- FactLedger.Updated
- MSI.Updated
- Question.Requested
- TaskGraph.Created
- ArchitectureSimulation.Completed
- RequirementContract.Compiled
- Planning.NeedsHumanReview

## Events consumed
- WorkCase.Created
- Customer.AnsweredQuestion
- Evidence.Uploaded
- Rules.MetadataUpdated
- Reality.NewFact callback

## Failure / recovery
- Ambiguous intent -> targeted clarification
- Conflicting facts -> flag and resolve
- Estimator low confidence -> wider range / more evidence
- Architecture simulation fail -> revise assumptions/resources
- Field reality -> targeted affected-node reanalysis, not full restart

## Human review
- High-risk/safety-sensitive work
- Regulatory uncertainty
- Conflicting low-confidence facts
- Very high cost/time impact
- Quality checker escalation

## Security / privacy
- Store only necessary facts
- Do not expose customer data to provider selection beyond need-to-know
- Model Gateway logging without leaking sensitive evidence
- Version every assumption and decision

## 1M-job scalability
- Fast clarification path uses deterministic Fact Ledger/MSI updates
- Strong models only at high-value reasoning checkpoints
- Async architecture simulation permitted
- Partition by WorkCase
- Cache task/rule metadata

## Non-negotiable invariants
- Plan before supply
- Use AI for meaning; code for authority
- Ask only material questions; never repeat known facts
- Full reanalysis only when affected scope cannot be isolated

## Golden regression scenarios
- Ground-floor statement suppresses irrelevant elevator question
- Multi-task sentence creates distinct TaskBlocks
- Field fact changes one TaskBlock without rebuilding unrelated tasks
- Requirement Contract remains provider-neutral

## Integrations / callbacks

- L1 Intake
- L3 Trust/Safety
- L4 Fulfillment
- L6 Commercial
- L09A Reality callback
- P2 DecisionTrace
- P4 Model Gateway

## Open questions
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no home in the mandated section order, so its content is recorded here and will be lost when this section is dropped: L1 Intake; L3 Trust/Safety; L4 Fulfillment; L6 Commercial; L09A Reality callback; P2 DecisionTrace; P4 Model Gateway. Note that "P2 DecisionTrace" and "P4 Model Gateway" here reuse the P-numbering that Board A assigns to engines (P2 Candidate Task Decomposer, P4 Fact Resolver) — it is unclear whether these are the same components or a separate platform-numbering scheme.
- Board B section 12 "LAYER PRINCIPLE / SELF-REVIEW STATUS" likewise has no section in the mandated order. Its text: "SELF-REVIEW PASS. Explicit authority boundaries, versioned inputs/outputs, deterministic gates where appropriate, failure/recovery behavior, human-review points, security/privacy controls, 1M-job logical scaling, callbacks, invariants and regression scenarios are all preserved. Adjacent layers cannot silently take this layer's authority."
- Name spelling variance: the poster uses "RequirementContract" as the artifact name (Board B section 2) and "RequirementContract vN" in Board A key outputs, but writes "Requirement Contract" (spaced) in the purpose statement, the gate "Requirement Contract internally consistent?", the flow step "Compile Requirement Contract vN", the Board A owns entry "Requirement Contract compilation" and the golden scenario "Requirement Contract remains provider-neutral". The closed-up "RequirementContract" is used as the artifact name; the spaced form is preserved verbatim where it appears in prose, gates, flow steps and scenarios.
- Name spelling variance: "FactLedger" is the artifact name (Board B section 2) and the event prefix (FactLedger.Updated), while "Fact Ledger" (spaced) appears in Board A key inputs, flow step 4 and Board B scalability. Same treatment as above.
- Board A key outputs list "TaskBlocks", "MSI state", "AbstractResourcePlan", "Estimates" and "ScenarioSet"; Board B lists the corresponding artifacts as "TaskBlock", "MSIItem", "AbstractResourceNeed", "Estimate" and "Scenario". Both spellings are transcribed in their own sections since they appear to be output-collection vs. object names, but a cross-layer link check may need a ruling on which form other layers reference.
- Board A key outputs include "MSI state" and Board B emits "MSI.Updated", but no data object named for MSI state itself is listed (only "MSIItem"). The poster does not say whether MSI state is a distinct persisted artifact or a derived rollup of MSIItem.
- The poster names "Completion Specification" in Owns and flow step 10 and "CompletionSpecification" as the artifact; no separate spelling ruling is given.
- Board A gates/flow reference an "explicit assumption accepted" path and Security requires "Version every assumption and decision", but the poster names no Assumption artifact among the authoritative data objects.
