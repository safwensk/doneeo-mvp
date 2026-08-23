# P6 — Event Backbone, Model Gateway, Observability & 1M-Job Scale Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Provide reliable event transport, scalable worker execution, model routing and full observability while keeping AI off authoritative hard-rule/state decisions.

## Owns
- Event/message backbone
- Worker pools
- Model Gateway
- Telemetry/observability
- Caches/read infrastructure
- Reliability patterns
- Regional scaling/deployment evolution

## Explicitly does not own
- Business decisions
- Rule authority
- Primary domain storage
- Identity/security policy
- Final financial truth

## Inputs
- Domain outbox events
- Commands/queues
- Model requests
- Metrics/logs/traces
- Regional config

## Authoritative outputs
- Event streams
- Worker queues
- ModelInvocationRef
- Metrics/traces/alerts
- DLQ/retry state

## Engines / components
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

## Main decision / operating path
1. P1/domain writes transactional outbox.
2. P6 transports at-least-once events to idempotent consumers.
3. Worker pools scale independently by domain load.
4. Model Gateway selects provider/model based on capability, risk, latency and cost; outputs advice/structured reasoning refs.
5. Deterministic domain validates model outputs before authority.
6. Observability tracks SLOs and cross-layer traces.
7. Bulkhead Execution/Payment from AI/Analytics.
8. Scale physically only when measured load justifies separation.

## Gates
- AI required on critical path? minimize/avoid where deterministic path exists.
- Queue saturation? autoscale/bulkhead.
- Model provider failure? fallback/defer noncritical reasoning.
- Regional failure? failover policy.

## Data objects
- EventEnvelope
- QueueMessage
- ModelInvocationRef
- Metric
- Trace
- Alert
- DLQItem
- RegionalConfig

## Events emitted
- Event.Delivered
- ModelInvocation.Completed
- Operational.AlertRaised
- DLQ.ItemCreated

## Events consumed
- Domain.OutboxReady
- All operational telemetry

## Failure / recovery
- Duplicate delivery → idempotent consumer.
- Poison event → DLQ.
- AI outage → deterministic core continues where possible.
- Search/read outage → slower authoritative path.

## Human review
- Regional failover
- SLO breach
- Model outage affecting material workflow
- Security incident

## Security / privacy
- PII-safe telemetry
- Service identity
- Secrets isolation
- Regional data policy

## 1M-job scalability
- Stage 1: modular monolith + relational DB + background workers.
- Stage 2: horizontal workers/event backbone/read models.
- Stage 3: selected service extraction from measured hotspots.
- Stage 4: multi-region partitioning/domain stores for sustained high load.
- Target is 1M+ jobs/month logical architecture, not a promise of 1M concurrent jobs.

## Non-negotiable invariants
- AI reasons/recommends; deterministic code/rules/state/versioning are authority.
- No mandatory multi-model consensus.
- Learning may propose, never auto-publish compliance rules.
- Scale changes HOW, not WHAT.
- Million-job logical architecture now; million-job physical infrastructure when load requires it.

## Supersedes / preserves
Supersedes P6 v1.0 statements implying AI models make domain decisions or 1M concurrent jobs as the canonical target. Preserves event/observability/reliability components.

## Integrations / callbacks

- P1 Orchestrator
- P2 Data
- All layers

