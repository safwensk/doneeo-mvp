# P4 — Platform Security, Fraud/Abuse & Trust Enforcement Architecture

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-20

## Purpose
Protect accounts, transactions, communications and platform operations through cross-cutting security, fraud/abuse controls and incident response without replacing job-specific Trust/Safety rules.

## Owns
- Platform threat/risk signals
- Fraud/abuse detection
- Account/device/session protective controls
- Transaction risk signals
- Runtime security enforcement
- Security incidents
- Cross-layer security holds

## Explicitly does not own
- Job-specific regulatory/rule/qualification authority (L3)
- Identity/AuthN/AuthZ ownership (P3)
- Privacy governance/DSR/retention (P8)
- Commercial/settlement decisions

## Inputs
- P3 identity/session context
- L3 safety/rule events
- P9 payment signals
- P6 telemetry/anomalies
- P7 abuse reports
- All-layer incident signals

## Authoritative outputs
- SecurityDecision
- FraudRiskSignal
- AbuseCase
- ProtectiveControl
- SecurityIncident
- SecurityHold

## Engines / components
- Threat Signal Engine
- Fraud/Abuse Detection
- Risk Scoring Engine
- Protective Control Engine
- Security Incident Manager
- Security Policy Enforcement Gateway

## Main decision / operating path
1. Collect cross-platform security signals.
2. Assess account/device/transaction/communication risk.
3. Apply deterministic security policy and protective controls.
4. Escalate severe/ambiguous cases to security operations.
5. For physical-job safety/legal qualification decisions, call L3 rather than duplicate it.
6. Record security facts/DecisionTrace in P2.

## Gates
- Platform security threat?
- Fraud/abuse threshold?
- Account/session control needed?
- Job-specific safety matter → L3?

## Data objects
- SecurityDecision
- RiskSignal
- ProtectiveControl
- SecurityIncident
- AbuseCase

## Events emitted
- Security.RiskDetected
- Security.ControlApplied
- Fraud.SignalRaised
- Abuse.CaseOpened
- Security.IncidentOpened

## Events consumed
- Identity.Event
- Payment.Signal
- Message.AbuseReport
- Telemetry.Anomaly
- L3.SafetyHold

## Failure / recovery
- False positive → controlled appeal/review.
- Security system unavailable → fail-safe according to risk class.
- Credential/physical work concern → route L3.

## Human review
- Account suspension/ban
- High-value fraud
- Severe abuse/harassment
- Security incident

## Security / privacy
- Least privilege
- Secrets/KMS
- Tamper-evident logs
- No unnecessary work content

## 1M-job scalability
- Stream risk workers
- Rate/velocity controls
- Regional security operations

## Non-negotiable invariants
- L3 owns job safety/legal/qualification decisions.
- P4 owns platform security/fraud/abuse/runtime protection.
- P3 owns identity/access.
- P8 owns privacy compliance.

## Integrations / callbacks

> Recovered by OCR from the PNG source poster; no SVG exists.
> Source poster uses a unified P1-P14 scheme in which P6=Providers, P8=Task Safety, P9=Messaging, P12=Settlement, P13=Claims and P14=Intelligence. NONE of those match current canon. Remap before use.

- From / To P1 Orchestrator (State, Events)
- From / To P2 Facts (Events, Entities)
- From / To P3 Identity (Identity, Risk Signals)
- From / To P6 Providers (Profiles, Status)
- From / To P8 Task Safety (Hazards, Controls)
- From / To P9 Messaging (Reports, Flags)
- From / To P10 Execution (Problems, State)
- From / To P12 Settlement (Chargebacks)
- From / To P13 Claims (Safety & Disputes)
- From / To P14 Intelligence (Risk Models)

## Supersedes / preserves
Corrects P4 overlap with L3/P3/P8 while preserving its fraud, abuse, incident and protective-control capabilities.
