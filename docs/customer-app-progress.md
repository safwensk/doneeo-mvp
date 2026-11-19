# Customer application progress and handoff — 2026-11-19

## Source and scope

Live GitHub heads were checked before this update: `main` at `0516ca35c3d9e8a29efd10141fe241bb92511d02`, and `frontend/redesign-main-flow` at `03925c28ca7c0d7580ea04cb93a51ea741d8e0d8`. The latter is the customer UI baseline and includes the architecture already merged into main. This update builds on it without rewriting the independent open frontend PR.

The locally developed React/Spring Boot application is now recorded under `customer-app/`. The repository root stays the single canonical planner. The original standalone bundle's nested clone is not duplicated into GitHub. Shared planner fixes are applied directly to their root files.

Doneeo remains the intelligence layer between a customer's problem and successful completion of physical work: understand, architect, plan, identify resources, coordinate/adapt and verify completion. Categories and examples are references, not a product boundary. The full executable order is the product; planning does not end at booking.

## Implemented customer flow

- The existing public landing visuals remain. A request entered before login is carried into the authenticated workspace.
- Login opens the main full-page AI discussion, using the original GitHub engine. Doneeo asks complementary questions one at a time, then exposes the existing planning choices when requirements permit.
- Account-scoped discussion and the latest native planner result persist across refresh/login. Typed answers, quick replies and operation retries preserve WorkCase/version continuity.
- The customer cleanup keeps the same stages, handlers and readiness rules. The header is compact, account/preview actions are in a menu, and technical/optional detail is expandable. Necessary resource approvals and totals remain visible.
- New request clears stale client readiness and begins a fresh conversation while keeping previous server-side records.
- The original design tokens are compiled into an isolated workspace stylesheet. Tailwind utility defaults are initialized inside the shadow root so borders, shadows and focus outlines render correctly.

## Boundaries and entry points

| Responsibility | Source |
|---|---|
| Public page and pending request | `customer-app/frontend/src/App.tsx` |
| Login/registration | `customer-app/frontend/src/components/AuthPanel.tsx` |
| Main authenticated mount/style isolation | `customer-app/frontend/src/components/DoneeoWorkspace.tsx` |
| Native customer flow and discussion | `customer-app/frontend/src/github/app/page.tsx`, `_components/ConversationScreen.tsx` |
| Original plan/confirmation/progress UI | `customer-app/frontend/src/github/app/_components/` |
| Session/CSRF and native contract adapters | `customer-app/frontend/src/lib/api.ts`, `workspace-api.ts` |
| Accounts, sessions and ownership | `customer-app/backend/src/main/java/com/doneeo/api/CustomerAccounts.java`, `CustomerSecurity.java` |
| Persisted native planning/discussion/retries | `customer-app/backend/src/main/java/com/doneeo/api/CustomerWorkspace.java` |
| Original-engine HTTP bridge | `customer-app/backend/src/main/java/com/doneeo/api/PlannerGateway.java` |
| Canonical WorkCase/JobOrder and planning | Root `app/api/plan/route.ts`, `lib/`, `db/`, `drizzle/` |
| Provider outage continuity | Root `lib/planning-continuity.ts` |
| Portable launch and stylesheet compilation | `customer-app/scripts/` |

Spring Boot protects customer access and persists ownership; it does not replace the deterministic engine or its version gates. The planner gateway uses HTTP/1.1 for compatibility with the local Worker emulator. Upstream 401/403 responses become gateway errors, preventing a route-provider authentication failure from expiring the customer's local login.

The frontend's `src/github/` directory is a deliberate UI snapshot/adaptation of the baseline above. Future changes to root UI components/domain helpers must be reconciled into that customer copy. Engine code is not copied: the running root engine is called through its native contracts. Earlier `ChatPanel`/chat API files remain as migration/reference code; the native workspace is the primary journey.

## Planner fixes included

1. Follow-up fallback uses the validated saved analysis before applying new confirmed answers. A provider outage no longer replaces an established plan with generic first-intake output.
2. The plan response returns confirmed answers for the customer adapter, labels saved-plan fallback mode honestly, and deduplicates audit issues.
3. A customer who declines packaging removal is not asked for the destination of removed packaging.
4. Continuity tests cover preserved task architecture, false values, missing snapshots and conditional packaging questions.
5. The existing architecture reachability test converts file URLs correctly on Windows instead of producing a doubled drive prefix; its reachability assertions are unchanged.

## Validation and limits

The preceding local work verified the browser journey through login, preserved intake, real planner response, complementary answers, refresh/resume, planning, demo confirmation, progress and logout on desktop/mobile. Backend integration tests cover ownership, authentication/CSRF, retry replay and persisted discussion using a local fixture. Publishing additionally validates the fresh repository layout through frontend compilation, backend integration tests and the original engine CI gates. Exact GitHub run results belong in the PR checks rather than an unsupported completion claim here.

No credentials, customer SQLite/D1 data, sessions, dependency trees, build output or local logs are published. Fresh checkouts use empty private databases unless an existing private data directory is explicitly configured. Optional provider keys are supplied locally through ignored configuration.

This remains a local preview. Real dispatch/fulfillment, payments, production account recovery/verification, hosted authentication and production operations remain unconfigured. Prototype providers/prices/availability and execution progress are simulated. Browser tracking simulation state does not resume after refresh. AI quota/demand and Maps credentials may limit live services; fallback status is visible.

The root LOGBOOK's open L09/L10 identity reconciliation and unimplemented downstream architecture work remain open. This update does not redefine layer ownership or claim end-to-end physical fulfillment is implemented.
