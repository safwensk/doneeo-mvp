# L3 — Trust, Safety, Rules & Compliance

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_03_TRUST_SAFETY_RULES_COMPLIANCE_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_03_TRUST_SAFETY_RULES_COMPLIANCE_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Act as a blocking control surface for legal, safety, qualification and policy requirements across planning, fulfillment, preflight and execution.

## Owns
- Rule applicability
- Risk/regulatory classification
- Qualification/control requirements
- Provider eligibility rules
- Dynamic risk reassessment
- Safety holds
- Policy exceptions and manual review

## Explicitly does not own
- Task planning
- Provider ranking beyond eligibility
- Pricing
- Payment capture
- Execution state
- Outcome truth

## Inputs
- TaskBlocks/method/location
- Requirement Contract
- Provider/team credentials
- Site/preflight context
- Evidence
- Versioned RulePack and regulatory sources

## Authoritative outputs
- RuleSet
- RiskProfile
- RequiredQualifications
- RequiredControls
- EligibilityDecision
- SafetyHold/Clearance
- DecisionTrace

## Engines / components
- Rule Applicability Engine
- Risk Classification Engine
- Regulatory Classifier
- Capability Policy Engine
- Provider Eligibility Rules Engine
- Dynamic Risk Engine
- Safety Hold Controller

## Main decision / operating path
1. T1 Requirement Classification during planning.
2. Issue RuleSet and controls.
3. T2 Provider/Team Eligibility before ranking.
4. Pass / PassWithControls / ManualReview / Block.
5. T3 Preflight/Field Eligibility immediately before/during work.
6. Dynamic reassessment on new reality.
7. Safety hold smallest affected scope when required.

## Gates
- T1 rules determined?
- T2 provider/team satisfies every hard requirement?
- T3 credentials/site/method still valid?
- Manual review required?

## Data objects
- RuleRelease
- RuleSet
- RiskProfile
- QualificationRequirement
- ControlRequirement
- EligibilityDecision
- SafetyHold
- PolicyException

## Events emitted
- Rules.Classified
- Eligibility.Passed
- Eligibility.PassWithControls
- Eligibility.Blocked
- SafetyHold.Placed
- SafetyHold.Cleared

## Events consumed
- RequirementContract.Compiled
- ProviderCandidate.Proposed
- Provider.Accepted
- Preflight.Requested
- RealityCase.Created
- Incident.Reported

## Failure / recovery
- Rule source unavailable -> conservative hold/manual review for material risk
- Expired credential -> block affected assignment
- Conflicting rules -> compliance review
- Unsafe field condition -> immediate hold

## Human review
- Rule conflict/ambiguity
- High/critical risk classification
- Borderline provider eligibility
- Policy exception
- Safety hold escalation

## Security / privacy
- Credential access least privilege
- Audit all rule decisions
- Effective-dated rules
- Protect sensitive provider records

## 1M-job scalability
- Versioned/cached RulePacks
- Deterministic evaluation workers
- Regional policy partitions
- Revalidate only affected entities on change

## Non-negotiable invariants
- Hard legal/safety constraints cannot be outvoted by optimization
- Eligibility at offer time does not imply dispatch readiness
- Payment never implies safety clearance

## Golden regression scenarios
- Licensed trade requires qualified provider
- Credential expires after booking before dispatch
- Field discovery changes regulatory classification

## Integrations / callbacks

- L2 Planning
- L4 Fulfillment
- L8 Preflight
- L09A Reality
- L10 Execution
- P2 DecisionTrace

## Open questions
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no home in the mandated section order. Its content is: L2 Planning, L4 Fulfillment, L8 Preflight, L09A Reality, L10 Execution, P2 DecisionTrace. Confirm whether the canonical format should carry an integrations/callbacks section, or whether these linkages are recovered from the consuming layers' specs.
- Artifact-name variance: Board A section 4 spells the planning input "Requirement Contract" (two words), while Board B section 4 uses "RequirementContract" inside the event name "RequirementContract.Compiled". Each spelling occurs once. The input bullet above preserves the Board A spelling verbatim; if the mechanical link check expects the single-token "RequirementContract" used by other layers, the input line needs normalising.
- The poster names the outputs "RequiredQualifications" and "RequiredControls" (Board A section 5) but the corresponding data objects "QualificationRequirement" and "ControlRequirement" (Board B section 2). These read as the same concepts under two names; the poster never states the relationship, so both are preserved as written.
- "SafetyHold/Clearance" is listed as a single output in Board A section 5, but Board B carries only the "SafetyHold" data object and the paired events "SafetyHold.Placed" / "SafetyHold.Cleared". Whether "Clearance" is a distinct artifact is not stated.
- Board A engines are labelled E1–E7 and Board B lacks any engine-to-gate mapping, so which engine evaluates T1, T2 and T3 is not stated in the poster.
- Board B section 12 records "SELF-REVIEW PASS" with the note that adjacent layers cannot silently take this layer's authority; there is no section in the mandated order for layer principle / self-review status, and the exemplar's "Supersedes / preserves" heading is not in the format's section list, so neither was emitted.
