# P3 — Identity, Consent & Access

**Status:** RECONCILED CANONICAL CANDIDATE
**Date:** 2026-08-23
**Source:** Doneeo_P3_IDENTITY_CONSENT_PRIVACY_ACCESS_ARCHITECTURE_FULL_DETAIL_v1.2_A (Board A) + Doneeo_P3_IDENTITY_CONSENT_PRIVACY_ACCESS_ARCHITECTURE_FULL_DETAIL_v1.2_B (Board B)

## Purpose
Own logical identity, organization, role, permission, consent and privacy policy for customers, executors, recipients, operators and external partners.

## Owns
- Customer/executor identities
- Organizations
- Roles/permissions
- Third-party recipient authorization
- Consent records
- Session/security context
- Visibility/privacy policies

## Explicitly does not own
- Job planning
- Provider eligibility
- Pricing
- Claims truth
- Financial settlement

## Inputs
- Authentication assertions
- User/org profiles
- Policy rules
- WorkCase/JobOrder role relationships
- Consent requests

## Authoritative outputs
- IdentityContext
- RoleAssignment
- PermissionDecision
- ConsentRecord
- RecipientAccessGrant
- SessionContext
- AuditAccessEvent

## Engines / components
- Identity Resolver
- Org/Role Manager
- Authorization Policy Engine
- Consent Manager
- Recipient Access Controller
- Session Security Service
- Privacy Policy Engine

## Main decision / operating path
1. Authenticate
2. Resolve identity/org/role
3. Evaluate requested action/resource
4. Check consent/recipient grant
5. Issue scoped access context
6. Audit sensitive access
7. Revoke/expire when needed

## Gates
- Identity verified?
- Role permits action?
- Consent valid?
- Recipient access scoped to relevant stop/info?

## Data objects
- Identity
- Organization
- Role
- Permission
- Consent
- AccessGrant
- Session
- AccessAudit

## Events emitted
- Consent.Granted
- Consent.Revoked
- Access.Denied
- Role.Changed
- RecipientGrant.Issued

## Events consumed
- WorkCase.Created
- Provider.Assigned
- Recipient.Linked
- Claim.Opened

## Failure / recovery
- Ambiguous recipient identity -> no broad disclosure
- Revoked consent -> remove future access
- Account compromise -> session revoke/security hold

## Human review
- Privilege escalation
- Organization ownership dispute
- High-sensitivity data request

## Security / privacy
- Least privilege
- Purpose limitation
- Data minimization
- Consent provenance
- Session/device security

## 1M-job scalability
- Central logical policy with regional enforcement
- Cache safe authorization data with short TTL
- No auth call should require AI

## Non-negotiable invariants
- Third-party recipients see only relevant information unless explicitly granted more
- Internal operators use role-scoped access
- Advertisers/partners never receive conversation/workcase data outside authorized service purpose

## Golden regression scenarios
- Receiver gets stop-specific instructions only
- Provider cannot view unrelated customer history
- Revoked recipient grant takes effect before next read

## Integrations / callbacks

- All layers
- P2 data access
- P1 command authorization

## Open questions
- Scope conflict with P8, deliberately left unresolved here. This v1.2 poster is titled "PLATFORM P3 — IDENTITY, CONSENT, PRIVACY & ACCESS ARCHITECTURE" and claims privacy authority explicitly: it owns "Visibility/privacy policies", runs engine E7 "Privacy Policy Engine", and lists "Purpose limitation" and "Data minimization" as its own security/privacy controls. In the newer v2.1 set, P8 (Privacy, Data Governance & Regulatory Compliance) owns privacy policy, classification, retention, DSR and compliance, and states the boundary as "P3 owns identity/access/consent grants; P8 owns privacy policy and data lifecycle", with P8's "Explicitly does not own" listing "Authentication/authorization/session identity (P3)". The P8 canonical spec also carries its own "PrivacyPolicy" output and "Privacy Policy Engine" component, so "Privacy Policy Engine" and privacy-policy authority currently appear in both layers. This spec transcribes the poster as written and does not narrow P3. Someone must decide whether P3 retains a privacy-policy engine at all, or whether the title becomes "Identity, Consent & Access" in substance as well as heading, with "Visibility/privacy policies" reframed as visibility/access scoping only.
- The mandated heading "# P3 — Identity, Consent & Access" already drops "Privacy" from the poster's own title. That renaming is applied to the heading only; the body still carries the poster's privacy claims, so heading and body disagree until the conflict above is settled.
- Board B section 9 "INTEGRATIONS / CALLBACKS" has no home in the mandated section order. Its content is: All layers, P2 data access, P1 command authorization. Confirm whether the canonical format should carry an integrations/callbacks section, or whether these linkages are recovered from the consuming layers' specs.
- Artifact-name variance between boards, each spelling occurring once. Board A section 5 outputs "ConsentRecord", "RecipientAccessGrant", "SessionContext" and "AuditAccessEvent"; Board B section 2 names the corresponding data objects "Consent", "AccessGrant", "Session" and "AccessAudit". Board B section 3 additionally emits "RecipientGrant.Issued", a third form of the recipient-grant name. The poster never states whether these are the same artifacts under output vs storage names, so both spellings are preserved as written; if the mechanical link check expects one token per artifact, these four pairs need normalising.
- Board A section 2 owns "Third-party recipient authorization" and Board B's invariants and regression scenarios speak of "recipients" and a "Receiver". Whether "Receiver" is the same role as "recipient" is not stated.
- Board A labels the engines E1–E7 and Board B gives no engine-to-gate mapping, so which engine evaluates each of the four gates is not stated in the poster.
- Board A section 4 lists "WorkCase/JobOrder role relationships" as an input but Board B consumes only "WorkCase.Created"; no JobOrder event appears anywhere on either board.
- The poster gives no lifecycle detail for consent or grants beyond "Revoke/expire when needed" — no TTL, no expiry semantics, and no statement of how "Cache safe authorization data with short TTL" is reconciled with the regression scenario "Revoked recipient grant takes effect before next read". The poster asserts both; it does not say how.
- Board B section 12 records "SELF-REVIEW PASS" with the note that adjacent layers cannot silently take this layer's authority; there is no section in the mandated order for layer principle / self-review status, and the exemplar's "Supersedes / preserves" heading is not in the format's section list, so neither was emitted.
