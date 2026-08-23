# P7 — Notifications, Messaging & User Engagement

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** "Doneeo P7 Messaging Architecture Blueprint.png" (single board, v1.0, dated 2026-08-19) — read visually; no SVG exists for this layer

> **Provenance warning.** The reconciliation package's evidence folder contains a
> file named `P7__KEEP.png` that is **not P7**. It is byte-identical (md5
> `284da22d…`) to `P10_DRIFT__DISCARD.png` — the Execution / Field Operations
> poster the register marks as generation drift to discard. The real P7 poster
> exists only in the figma folder and was never carried into the reconciliation.
> Anyone rebuilding P7 from that evidence set would have rebuilt the discarded
> P10 layer.
>
> **Numbering warning.** Section C scopes exclusions as "Layers 01–10",
> "Layers 02–03" and "Layers 11–12", mixing domain and platform numbering — the
> same board writes those platform layers as P2/P3 in section I. Platform hooks
> (P1–P6) do match current canon.

## Purpose

Orchestrate intelligent, contextual and reliable communication across the Doneeo
ecosystem — the right message, to the right person, at the right time, on the
right channel.

## Owns

- Deliver timely, relevant and actionable messages
- Engage users across the journey
- Support transactional and conversational messaging
- Personalize by context, role and preference
- Ensure reliability, delivery and compliance
- Provide user communication preferences
- Measure engagement and message effectiveness
- Route messages to the right channel
- Personalize content by context and profile
- Trigger messages from events and workflows
- Support two-way conversations
- Manage templates, localization and rendering
- Handle delivery, retries and fallbacks
- Track delivery, opens, clicks and replies
- Support escalation and urgent alerts

## Explicitly does not own

- Business or orchestration decisions (Layers 01–10)
- Data storage or identity (Layers 02–03)
- Security enforcement (P4)
- Financial transactions (Layers 11–12)
- State or truth (P2) or orchestration (P1)

## Inputs

Message context sources:

- WorkCase / Job State
- User Profile & Preferences
- Location & Time
- Device & Channel
- Behavior & History
- Risk & Safety Signals
- AI Insights & Predictions
- External Systems
- Business Rules
- Seasonality & Trends

## Authoritative outputs

- MessageEvent (02)
- MessageDelivery (03)
- MessageEngagement (04)
- UserPreferences (05)
- OptInConsent (06)

## Engines / components

- Message Orchestration — event-driven triggers, workflow-based messages, journey orchestration, sequencing & throttling, conditional logic, A/B message variants
- Template & Content Management — reusable templates, dynamic content, localization & translation, versioning & approvals, branding & theming, rich content support
- Personalization & Targeting — user profile & preferences, role-based targeting, contextual personalization, behavior-based targeting, geographic & time-based, segmentation & audiences
- Delivery & Routing — channel selection, priority routing, delivery optimization, retry & fallback, rate limiting, carrier & provider management
- Conversations & Replies — two-way messaging, threading & context, quick replies, human handoff, auto-responders, conversation history
- Preferences & Control — channel preferences, frequency control, quiet hours, opt-in / opt-out, topic subscriptions, preference center
- Analytics & Engagement — delivery status, open / read / click, reply & response rate, conversion tracking, engagement scoring, campaign performance
- Compliance & Safety — SPAM / abuse prevention, content filtering, PII & data protection, legal compliance, retention policies, audit & logging

## Main decision / operating path

Message flow, typical path:

1. Event / Trigger — from any layer
2. Message Decision — orchestration
3. Audience & Preference — targeting
4. Template & Content — render
5. Channel Selection — routing
6. Delivery — send
7. User Receives — read / interact
8. User Action / Reply — optional
9. Track & Capture — events
10. Analytics & Insights — measure
11. Feedback Loop — optimize

Failed sends re-enter at Failed / Retry / Fallback. Replies and interactions
re-enter as Reply / Interaction. The measure step feeds Learn & Optimize back
into orchestration.

## Gates

- (not specified in source poster — this board carries no decision-gate section)

## Data objects

- MessageEvent (02)
- MessageDelivery (03)
- MessageEngagement (04)
- UserPreferences (05)
- OptInConsent (06)
- Reports & Analytics (14)

Message types: Transactional (receipts, confirmations) · Operational (updates,
status) · Marketing (promotions, offers) · System (alerts, maintenance) · Safety
(warnings, emergencies) · Conversational (chat, replies) · Engagement (tips,
nudges) · Survey / Feedback · Billing & Payment · Escalation / High Priority

Channels: In-App Inbox · Push Notifications · Email · SMS / OTP · Voice / Call ·
WhatsApp / RCS · Web Chat · Provider / Executor App · Web Dashboard · External
Webhooks · API to Partner Systems

Delivery states: Queued · Sending · Sent · Delivered · Read / Opened ·
Clicked / Engaged · Replied · Failed · Bounced · Suppressed · Unsubscribed

User journeys supported: Onboarding & Welcome · Job Lifecycle Updates ·
Provider / Executor Updates · Payment & Billing · Safety & Compliance ·
Reminders & Deadlines · Promotions & Offers · Surveys & Feedback ·
Escalations & Alerts · Re-engagement

## Events emitted

- (not specified in source poster as a typed event list; the board models delivery states rather than domain events)

## Events consumed

- (not specified in source poster; triggers arrive as "Event / Trigger — from any layer")

## Failure / recovery

- Auto retry & backoff
- Fallback channels
- Rate limiting
- Concurrency control
- Circuit breaker
- Idempotency
- Failed / Retry / Fallback re-entry into the message flow

## Human review

- Human handoff from a conversation
- Content approval
- (no further human-review triggers specified in source poster)

## Security / privacy

- Data Privacy (GDPR, PIPEDA)
- Consent Management
- Message Audit Trail
- Content Approval
- Retention & Deletion
- Accessibility (WCAG)
- Language & Localization
- Legal Disclaimers
- CAN-SPAM / CASL
- Policy Enforcement
- PII & data protection
- SPAM / abuse prevention

## 1M-job scalability

- High delivery success
- Low latency
- Bulk sending optimization
- Provider health monitoring
- Concurrency control
- Rate limiting

Engagement metrics tracked: Delivery Rate · Open Rate · Click Through Rate (CTR) ·
Reply Rate · Conversion Rate · Unsubscribe Rate · Spam Report Rate · Time to
First Interaction · Engagement Score · Journey Completion Rate

## Non-negotiable invariants

Communication principles, as printed:

- Relevant — context-aware messages
- Timely — right time, not too much
- Personalized — user, role and context
- Actionable — clear call to action
- Reliable — deliver or retry
- Respectful — user preferences first
- Two-Way — listen and respond
- Inclusive — accessible and localized
- Compliant — legal and policy aligned
- Measurable — track and improve
- P7 writes communication facts to P2

## Integrations / callbacks

- From P1 (Orchestrator) — Events / Commands
- From P2 (Ledger) — Facts / State Changes
- From P3 (Identity) — User / Role / Profile
- From P4 (Security) — Alerts / Restrictions
- From P5 (Integrations) — External Events
- From P6 (AI / Observability) — Insights
- To Channels / Providers — Delivery APIs
- To Analytics / Warehouse — Engagement Data

## Golden regression scenarios

- (none — this board predates the golden-scenario template and carries no such section)

## Open questions

- **The evidence set is wrong for this layer.** `P7__KEEP.png` in the reconciliation package is the discarded P10 poster, verified byte-identical by md5. The register should be corrected and the real poster carried in.
- Section C mixes numbering schemes in one list: "Layers 02–03" for what section I calls P2/P3, and "Layers 01–10" / "Layers 11–12" for domain layers. Needs one scheme.
- This board is v1.0 single-board and was never migrated onto the seventeen-section template, so it has no Gates, typed Events, or Golden regression scenarios. Those must be authored fresh rather than recovered — there is nothing to recover.
- `MessageEvent (02)` … `OptInConsent (06)` carry numeric suffixes whose meaning is unstated; likely Fact Ledger table ids, same convention as P5.
- The board names "P6 (AI / Observability)" — this matches current canon P6, unlike the v1.2 poster set where P4 held that role. P7 is therefore already on the newer platform numbering while P5 is not.
- Quiet hours and frequency control are owned here, but no interaction is specified with L3 safety escalation, where an urgent safety message presumably must override a quiet-hours preference.
