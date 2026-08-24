# L8 — Execution Preparation, Preflight & Dispatch Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Convert a committed booking into a dispatch-ready, role-scoped mission by revalidating time-sensitive credentials, resources, access and site readiness.

## Owns
- MissionPackage compilation
- Role-scoped executor briefing
- Team coordination
- Resource/material/rental readiness
- Access/recipient readiness
- T3 eligibility invocation
- Dispatch readiness
- En-route handoff

## Explicitly does not own
- Live execution (L10)
- Requirement architecture (L2)
- Safety/rule authority (L3)
- Pricing (L6)
- Final settlement (L12)
- Outcome verification (L11)

## Inputs
- Committed ScopeContract
- RequirementContract
- Accepted team/roles
- CapacityReservations
- Resource reservations
- Access/recipient context
- Current rules/credentials
- Schedule/route

## Authoritative outputs
- MissionPackage
- ProviderBrief
- PreflightChecklist
- ResourceReadiness
- AccessReadiness
- DispatchDecision
- ExecutionReady

## Engines / components
- Mission Compiler
- Executor Briefing Engine
- Team Coordination Engine
- Preflight Engine
- Credential Revalidation Coordinator
- Resource Confirmation Engine
- Access Readiness Engine
- Dispatch Controller

## Main decision / operating path
1. Compile role-scoped mission from current authoritative versions.
2. Confirm team/role acceptance and handoff context.
3. Confirm tools/materials/rentals/vehicle readiness.
4. Invoke L3 T3 current credential/site/method eligibility.
5. Confirm access, recipient, parking/floor/time-window conditions.
6. Resolve blockers through L4/L5/L7 without changing requirement unless 09A/L2 says so.
7. Gate Dispatch.Ready only after all hard readiness checks pass.
8. Dispatch and hand ExecutionReady package to L10.
9. Arrival may immediately invoke 09A On-Site Reality Check.

## Gates
- All assigned roles present?
- Critical resources confirmed?
- T3 clearance current?
- Access/start window confirmed?
- Dispatch safe and feasible?

## Data objects
- MissionPackage
- ProviderBrief
- PreflightChecklist
- ResourceReadiness
- CredentialCheckRef
- AccessReadiness
- DispatchDecision

## Events emitted
- Preflight.Started
- Preflight.Passed
- Preflight.Blocked
- Dispatch.Ready
- Provider.EnRoute

## Events consumed
- Provider.Accepted
- Resource.Reserved
- Credential.Updated
- AccessContext.Updated
- Cancellation.Requested

## Failure / recovery
- Credential expiry → hold affected role + L4 rematch.
- Rental unavailable → L5 recovery before dispatch.
- Access unavailable → L7 reschedule/contact.
- Team member decline → replace role only.

## Human review
- Credential conflict
- High-risk access/site
- Critical resource unresolved
- Manual exception request

## Security / privacy
- Executor sees mission-relevant customer data only.
- Recipient visibility scoped by P3.
- No unnecessary financial/customer history exposed.

## 1M-job scalability
- Parallel preflight checks
- Authoritative recheck before dispatch
- Regional dispatch queues
- WorkCase/JobOrder ordered events

## Non-negotiable invariants
- Provider acceptance ≠ dispatch readiness.
- Payment authorization ≠ dispatch readiness.
- L8 ends at ExecutionReady/Dispatch; L10 owns live execution.
- Arrival Reality Check is separate from pre-departure preflight.

## Supersedes / preserves
Supersedes the Layer 8 'Execution Orchestration & Live Control' poster as an L8 authority. Useful live-control mechanics move to L10.

## Integrations / callbacks

- L3 Trust/Safety
- L4 Fulfillment
- L5 Resources
- L7 Commitment
- L09A Reality
- L10 Execution

