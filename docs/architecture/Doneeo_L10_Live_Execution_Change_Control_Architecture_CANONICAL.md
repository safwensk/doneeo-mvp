# L10 — Live Execution & Change Control

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_10_LIVE_EXECUTION_CHANGE_CONTROL_ARCHITECTURE_FULL_DETAIL_v1.2_A + Doneeo_10_LIVE_EXECUTION_CHANGE_CONTROL_ARCHITECTURE_FULL_DETAIL_v1.2_B

## Purpose
Control TaskBlock execution, milestones, timing, evidence, handoffs and issue/change detection; route material reality changes to 09A rather than improvising scope.

## Owns
- Execution state machine
- TaskBlock progression
- Milestones/checkpoints
- Execution Journal
- Live timing/ETA
- Handoffs
- Issue/change detection
- Approved adaptation application
- Completion submission

## Explicitly does not own
- Requirement architecture
- Responsibility allocation
- Final outcome verification
- Pricing/settlement
- Claims

## Inputs
- Execution-ready MissionPackage
- WorkPlan
- TaskGraph/dependencies
- Resources
- Completion Specification
- Customer/recipient communication rules

## Authoritative outputs
- ExecutionState
- ExecutionJournal
- MilestoneRecord
- IssueSignal
- ChangeEvent
- HandoffRecord
- CompletionSubmission

## Engines / components
- Execution State Engine
- TaskBlock Controller
- Milestone Engine
- Execution Journal Writer
- Live Timing Engine
- Handoff Controller
- Change Event Detector
- Adaptation Applier
- Completion Submission Engine

## Main decision / operating path
1. Execution Ready
2. Start TaskBlock / actual timer
3. Track progress and milestones
4. Append actions/evidence to journal
5. Detect issue/change
6. Material reality? -> 09A callback
7. Apply approved recovery/plan version
8. Continue unaffected tasks
9. Handoff if role/stop changes
10. Submit completion package to L11

## Gates
- Task prerequisites satisfied?
- Can next TaskBlock start?
- Issue requires 09A?
- Handoff acknowledged?
- Completion package complete?

## Data objects
- ExecutionState
- ExecutionJournalEntry
- MilestoneRecord
- ActualTime
- IssueSignal
- HandoffRecord
- CompletionSubmission

## Events emitted
- Execution.Started
- Milestone.Reached
- Issue.Detected
- RealityCase.Requested
- Handoff.Completed
- Completion.Submitted

## Events consumed
- Dispatch.Ready
- RecoveryDecision.Approved
- RequirementContract.Updated
- Resource.Ready

## Failure / recovery
- Network outage -> offline-safe journal queue then reconcile
- Provider no-show -> fulfillment recovery
- Unsafe event -> L3 hold via 09A
- Handoff failure -> pause dependent work only

## Human review
- High-impact issue
- Customer complaint during work
- Safety incident
- Completion exception

## Security / privacy
- Role-scoped live data
- Location tracking only when required
- Evidence retention policy
- Audit every adaptation

## 1M-job scalability
- Event-driven live updates
- WorkCase/JobOrder scoped ordering
- Read models for customer/executor UI
- AI not on critical path for timer/state

## Non-negotiable invariants
- Execution never self-expands scope
- Journal append-only
- Actuals are evidence, not automatically customer charges
- Continue unaffected work where safe

## Golden regression scenarios
- Delay changes ETA without RC change
- Hidden condition triggers 09A
- Provider handoff preserves context and evidence

## Integrations / callbacks

- L8 Dispatch
- L09A Reality
- L09B Fairness economic signal
- L11 Outcome
- P1 Orchestrator

## Open questions
- The L8/L10 boundary ("L8 ends at dispatch, L10 owns everything live") is not stated on this poster, so it is not recorded under "Explicitly does not own". The only traces of the handoff in this source are Board A input "Execution-ready MissionPackage", flow step 1 "Execution Ready", Board B consumed event "Dispatch.Ready" and Board B integration "L8 Dispatch". Confirm whether the boundary statement should be added here or is carried only by the L8 spec (which states "L8 ends at ExecutionReady/Dispatch; L10 owns live execution").
- Board A input names the package "Execution-ready MissionPackage" (lowercase "ready", hyphenated); the L8 poster's authoritative output is "ExecutionReady" and "MissionPackage" as separate artifacts. Only one spelling appears in this poster, so it is preserved verbatim, but the mechanical link between "Execution-ready MissionPackage" and L8's "ExecutionReady"/"MissionPackage" should be confirmed.
- "ChangeEvent" appears in Board A KEY OUTPUTS but has no matching entry in Board B's data/artifact objects or events emitted. Confirm whether it is a distinct artifact, or the same thing Board B carries as "Issue.Detected"/"IssueSignal".
- "Execution Journal" (Owns), "ExecutionJournal" (KEY OUTPUTS) and "ExecutionJournalEntry" (Board B data object) are three spellings of what appears to be one artifact family. Each is preserved as written in its own section; confirm the canonical artifact name.
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no home in the mandated section order, so its content is recorded here and will be lost when this section is dropped: L8 Dispatch; L09A Reality; L09B Fairness economic signal; L11 Outcome; P1 Orchestrator. Note that L09B is referenced only here — the operating flow routes to 09A and L11 but never to 09B.
- Board B section 12 "LAYER PRINCIPLE / SELF-REVIEW STATUS" likewise has no section in the mandated order. Its text: "SELF-REVIEW PASS. Explicit authority boundaries, versioned inputs/outputs, deterministic gates where appropriate, failure/recovery behavior, human-review points, security/privacy controls, 1M-job logical scaling, callbacks, invariants and regression scenarios are all preserved. Adjacent layers cannot silently take this layer's authority."
- Other specs in this set end with a "Supersedes / preserves" section (L8's says "Useful live-control mechanics move to L10", and this layer is where the drifted "Layer 9" execution posters were merged). SPEC_FORMAT.md's exact section order does not include that heading, so none was emitted; confirm whether L10 needs one recording the merged Layer 9 execution posters.
- Board A's engine list is numbered E1–E9 on the poster. The numbering is dropped here to match the plain-bullet rule; confirm the E-numbers are not referenced mechanically elsewhere.
