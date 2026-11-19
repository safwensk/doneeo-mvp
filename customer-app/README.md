# Doneeo customer application

Doneeo understands a customer's real-world problem, architects a solution, identifies the resources and plan, and carries the work toward verified completion. Examples help explain requests; they do not limit what a customer can ask.

This local preview adds the customer journey around the canonical planner in the repository root. The existing landing-page visuals are preserved. After login, the conversation is the main page, followed by the original planning options, resource approvals, demo confirmation and progress screens.

## Runtime boundaries

```text
Browser :5173 -> React/Vite /api proxy -> Spring Boot :8080
                                             |
                                             v
                                  Canonical planner :5174
                                  TypeScript / Worker / D1
```

Spring Boot owns customer accounts, sessions, CSRF protection, saved discussion, account-scoped planner access and exact-operation retries. The original engine continues to own WorkCases, JobOrders, requirement contracts, rules, planning and version checks. It has not been translated into Java or replaced with a scripted chat.

## Prerequisites

- Node.js 22.13+ with npm (the same requirement as the root project).
- Java 21 JDK. Set `JAVA_HOME` or put Java on `PATH`.
- Maven 3.9+ on `PATH`, or set `DONEEO_MAVEN_HOME` to its installation directory.
- A POSIX shell for the original planner's build/test scripts; Git Bash works on Windows.

Use a short checkout path on Windows if dependency extraction hits path-length limits.

## Windows quick start

From this directory, double-click `START_DONEEO_WINDOWS.bat`, or run:

```powershell
.\START_DONEEO_WINDOWS.bat
```

Open **http://localhost:5173/**. The launcher installs missing npm dependencies, applies pending local planner migrations without resetting data, then starts the planner, Java API and React app. It reuses healthy services already on their expected ports. Startup logs go into `.local-run/`.

If the launcher reports an old service on port 8080, stop that old instance and start again. First-time dependency downloads can take longer than the health-check window; inspect the logs before retrying.

## Start services separately

Install the two locked npm dependency sets once, from the repository root:

```sh
npm ci
npm --prefix customer-app/frontend ci
```

On Windows, `START_PLANNER_WINDOWS.bat`, `START_JAVA_WINDOWS.bat` and `START_REACT_WINDOWS.bat` start each service separately.

On macOS/Linux, use three terminals:

```sh
# Terminal 1, repository root: prepare the local D1 schema and start the engine
npm run db:local -- --keep
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

```sh
# Terminal 2, repository root
mkdir -p customer-app/.local-run
cd customer-app/backend
mvn spring-boot:run
```

```sh
# Terminal 3, repository root
npm --prefix customer-app/frontend run dev -- --host localhost --port 5173 --strictPort
```

Keep all three services local for this preview. The frontend development proxy sends `/api` to Java, which calls the planner using HTTP/1.1. The supplemental **Account > Preview tools** links open the original planner on localhost:5174; these development surfaces are not customer-facing hosted routes.

## Optional configuration and private state

Copy the repository's `.env.example` to `.env.local` at the **repository root**. Fill only the optional model or Maps keys you want to use. Never put keys in frontend `VITE_*` variables. Empty keys allow deterministic local planning; live routing and model providers need their own valid credentials, quota and permissions.

`DONEEO_PLANNER_DIR` can override the engine directory for the Windows launcher and CSS builder. By default they find the repository root. Standalone source bundles with a nested `planner-engine/` also remain supported.

The Java launcher creates `customer-app/.local-run/customers.sqlite` by default. Set `DONEEO_DATA_DIR` to an existing private data directory to resume accounts from an earlier local setup. When running Maven manually, create the data directory first. `DONEEO_PLANNER_URL` can override Java's default `http://127.0.0.1:5174` through Spring's environment binding.

Planner state lives separately in the root `.wrangler/state/`. Preserve **both** the customer SQLite database and the planner D1 state when moving existing local work. Do not overwrite either with a fresh checkout. No database, session, password hash, private environment file or runtime log is included in this source update.

## Customer journey

1. Write any need on the landing page, then create an account or log in. The pending request survives login.
2. Doneeo opens a full-page conversation, uses the actual engine result and asks the next missing question. Typed replies and quick answers update the same versioned work.
3. Discussion turns and the latest analysis are saved to the account. Refresh or log in again to resume. **New request** starts a fresh screen without deleting previously saved server-side work.
4. Once the canonical requirements allow it, continue to planning options. Compare plans, review resources and estimates, approve what is required, then enter the demo confirmation/progress flow.

The compact header retains all three steps. Account actions and preview tools are in the account menu. Technical explanations, complete plan records and optional controls are expandable. Resource approvals, totals and readiness checks remain available with the same action handlers.

## What is implemented

- BCrypt password hashing, normalized email identities, rotated login sessions, HttpOnly/SameSite cookies and CSRF-protected writes.
- Owner-scoped conversations, saved planner responses and work-order references.
- Stable retry identifiers, stale-question checks and version-aware answer forwarding; retries do not duplicate discussion turns.
- The existing GitHub planner UI mounted as the main authenticated workspace, with isolated original styling and working utility borders/focus outlines.
- Provider outage continuity: follow-ups keep the last saved architecture and confirmed answers. Initial outages use the existing deterministic draft. The service status explains the active mode.
- An upstream Maps authentication error is reported as a gateway error rather than logging the customer out.

## Preview limitations

This is a local prototype, not a production launch. Email verification, password reset, social login, public hosting and production deployment controls are not configured. Provider identities, ratings, availability, pricing, payment authorization and execution milestones are simulated prototype data. No real charge, message, rental purchase or provider dispatch occurs. Saved planner/work-order data is durable locally; browser tracking simulation state is not durable across refresh.

The optional AI and route services may fail because of unavailable quota, provider demand or invalid credentials. A fallback preserves continuity; it does not prove that the model-generated plan is complete. The wider architecture's partially implemented layers and open identity reconciliation remain documented in the root LOGBOOK; this customer app does not close those gaps.

## Checks

From the repository root:

```sh
npx tsc --noEmit -p tsconfig.check.json
npm test
npm --prefix customer-app/frontend run build
```

From `customer-app/backend`:

```sh
mvn test
```

The Java integration tests use an isolated HTTP planner fixture and an in-memory H2 database. They check login/CSRF, password hashing, account isolation, migration, native payloads, saved discussion, answer forwarding, retries, readiness and upstream authentication failures. They do not call paid model providers or modify local customer databases. GitHub CI runs the original engine checks and separate customer frontend/backend jobs.

See [the progress and handoff record](../docs/customer-app-progress.md) for source provenance, code entry points and remaining work.
