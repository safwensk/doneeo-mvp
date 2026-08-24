# P2 — Data, Fact Ledger, Evidence & DecisionTrace Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Make every material fact, evidence object, artifact version and decision reconstructable while keeping domain ownership explicit and derived data subordinate.

## Owns
- Logical data ownership map
- Fact Ledger provenance
- Evidence/object references
- DecisionTrace
- Validity/expiry metadata
- Transactional inbox/outbox/event log persistence
- Derived read/search/warehouse projections

## Explicitly does not own
- Business decisions
- Event transport/backbone (P6)
- One giant cross-domain mutable record
- External-system truth

## Inputs
- All domain writes/events
- Evidence files
- Rule/model/solver refs

## Authoritative outputs
- Authoritative domain records
- Fact lineage
- DecisionTrace
- EvidenceRefs
- Derived read/search models
- Warehouse exports

## Engines / components
- Fact Ledger Service
- DecisionTrace Service
- Domain Store Adapters
- Inbox/Outbox Store
- Read Model Projectors
- Search Indexer
- Warehouse Exporter
- Object Store Gateway

## Main decision / operating path
1. Domain owner writes authoritative record.
2. Append provenance and transactional outbox atomically.
3. DecisionTrace links input artifact versions, facts, rule release, model/solver refs, reasons/confidence, validity and supersession.
4. P6 transports events; P2 persists source/event lineage where required.
5. Project READ/SEARCH/WAREHOUSE asynchronously.
6. Revalidation triggers fire on expiry/material updates.

## Gates
- Authoritative owner known?
- Expected version valid?
- Evidence provenance present?
- Derived data clearly marked non-authoritative?

## Data objects
- DB-A WorkCase
- DB-B Fact Ledger
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

## Events emitted
- Fact.Appended
- DecisionTrace.Created
- Artifact.Versioned
- Projection.Updated

## Events consumed
- All domain events

## Failure / recovery
- Projection lag → source remains authoritative.
- Index inconsistency → rebuild.
- Object missing → preserve reference/status.
- Schema migration → versioned compatibility.

## Human review
- Source-data correction
- Evidence legal hold
- Privacy deletion exception

## Security / privacy
- Encryption
- Retention/legal hold
- Access audit
- Purpose limitation

## 1M-job scalability
- Partition by domain/WorkCase/region as needed
- CQRS projections
- Derived indexes rebuilt from source/event history

## Non-negotiable invariants
- No giant JobOrder JSON.
- Fact Ledger does not mean all domain tables collapse into one store.
- Derived read/search/warehouse never outranks source.
- DecisionTrace is first-class.
- Validity/expiry is first-class.
- P6 owns event transport, not P2.

## Supersedes / preserves
Corrects the P2 Fact Ledger poster where it implies a single physical store/event backbone. Preserves append-only provenance and immutable evidence concepts.

## Integrations / callbacks

- All domain layers
- P1 Orchestrator
- P3 access policy
- P4 observability/analytics

