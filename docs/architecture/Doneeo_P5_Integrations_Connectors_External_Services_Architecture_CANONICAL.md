# P5 — Integrations, Connectors & External Services

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** P5__KEEP.png (single board, v1.0, dated 2026-08-19) — read visually; no SVG exists for this layer

> **Numbering warning.** This poster predates the current layer scheme and its
> cross-references are NOT valid against canon. It cites "Layer 06 (Planning)",
> "Layer 13 (Disputes)" and **"Layer 14 (Intelligence)"** as distinct layers, and
> scopes exclusions as "Layers 06–10" and "Layers 11–12". Current canon has
> thirteen domain layers with Intelligence and Planning merged into L2. Every
> layer reference below is transcribed as printed and must be remapped before
> use. Platform references (P1–P4) do match current canon.

## Purpose

Securely connect Doneeo to external systems, APIs, data and services with
resilience, observability and governance.

## Owns

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

## Explicitly does not own

- Business logic or decisions (Layers 06–10)
- Data storage or ledger (P2)
- Identity or access (P3)
- Security enforcement (P4)
- Orchestration or state (P1)
- Financial settlement (Layers 11–12)

## Inputs

- (not specified in source poster — the board states hooks rather than typed inputs; see Integrations / callbacks)

## Authoritative outputs

- IntegrationEvent (02)
- ExternalInteraction (03)
- ConnectorLog (P5)
- AuditLog (P5)

## Engines / components

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

## Main decision / operating path

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

## Gates

- (not specified in source poster — this board carries no decision-gate section)

## Data objects

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

## Events emitted

- (not specified in source poster — no events section on this board)

## Events consumed

- (not specified in source poster — no events section on this board)

## Failure / recovery

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

## Human review

- (not specified in source poster — the board lists a manual resolution flow and approval workflow but no human-review triggers)

## Security / privacy

- Secure transport (TLS 1.2+)
- Secrets management (Vault / KMS)
- Least privilege access
- Data minimization
- PII / sensitive data controls
- Compliance monitoring
- Audit logging

## 1M-job scalability

- Health checks
- Metrics & dashboards
- Alerting & notifications
- Distributed tracing
- Log aggregation
- Usage analytics
- SLA / SLI monitoring

## Non-negotiable invariants

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

## Integrations / callbacks

- From P1 (Orchestrator) — Command / Event Integration
- From P2 (Ledger / Events) — Events / Facts Integration
- From P3 (Identity / Access) — AuthN / AuthZ Integration
- From P4 (Security / Safety) — Risk / Policy Integration
- From Layer 06 (Planning) — External Data / APIs
- From Layer 10 (Execution) — Status / Tracking / ETA
- From Layer 11 (Outcome) — Evidence / Reports
- From Layer 12 (Settlement) — Payment / Payout / Tax
- From Layer 13 (Disputes) — Evidence / Case Data
- From Layer 14 (Intelligence) — Insights / Enrichment

## Golden regression scenarios

- (none — this board predates the golden-scenario template and carries no such section)

## Open questions

- The layer references above are from a superseded numbering scheme. "Layer 14 (Intelligence)" has no counterpart in current canon, where Intelligence and Planning are one layer (L2). "Layer 06 (Planning)" maps to L2, not to L6 (Commercial Offer & Pricing) — a reader who does not know this will wire P5 to the pricing layer.
- The board lists no P5→P6 hook, though P6 owns event transport and P5 does event streaming. Relationship unstated.
- No Gates, Events emitted, Events consumed, Human review or Golden regression scenarios sections exist on this board. It is a single-board v1.0 poster, not an A/B pair, so it was never brought onto the seventeen-section template the other eighteen layers use.
- `IntegrationEvent (02)` and `ExternalInteraction (03)` carry numeric suffixes whose meaning is not stated; they may be Fact Ledger table ids.
- `Reports & Analytics (14)` appears in the Fact Ledger linkage chain but is not owned by P5 and layer 14 does not exist in canon.
