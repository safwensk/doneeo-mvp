# Doneeo Intelligence MVP

Doneeo is the intelligence layer between a customer's problem and the successful completion of physical work. This repository is the canonical build: a Next.js app on Cloudflare whose core is a deterministic planning engine that turns a plain-language request into a structured, validated, costed work order.

The full order is the product. Planning does not end at booking.

## Requirements

- Node.js `>=22.13.0`
- A POSIX shell for the lifecycle scripts (Git Bash on Windows is what this project is developed on)

## Running locally

```bash
npm run install:ci   # one bounded, non-retrying lockfile install
npm run dev          # Vite + vinext; Miniflare emulates Cloudflare and D1
```

No Cloudflare account is needed for local development. Miniflare emulates the Worker runtime and the D1 binding, and the database self-seeds executors on first use.

```bash
npm run build             # build and validate the deployable Sites artifact
npm test                  # build, verify rendered HTML, run the engine test suite
npm run lint
npm run db:generate       # regenerate Drizzle migrations after editing db/schema.ts
npm run validate:artifact # recheck an existing artifact's manifest and ESM export
```

`npm run build` and `npm run validate:artifact` are diagnostic tools for use after a remote failure. They are not part of the normal checkpoint path — the remote Sites builder runs the build against the pushed commit.

## Environment

Secrets live only in `.env.local`, which is git-ignored and never committed.

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | The drafting model. Without it the deterministic planner handles every request. | Recommended |
| `GEMINI_MODEL` | Defaults to `gemini-3.6-flash`. | No |
| `GEMINI_THINKING_LEVEL` | Defaults to `medium`. Lower it if responses hit the token ceiling. | No |
| `XAI_API_KEY` | Enables the Grok validator. | No |
| `OPENAI_API_KEY` | Enables the OpenAI validator. | No |
| `ANTHROPIC_API_KEY` | Enables the Claude validator. `CLAUDE_MODEL` overrides the default. | No |
| `GOOGLE_MAPS_API_KEY` | Multi-stop routing and traffic-aware ETAs. The legacy name `GOOglemap_API_KEY` is still honoured. | No |

Every model key is optional. A validator with no key returns null and simply does not count; the route endpoint returns 503 rather than failing silently.

## Architecture

### Canonical L01–L13 control spine

The MVP now uses one master lifecycle registry in `lib/canonical-architecture.ts`. It defines the 13 domain layers, nine shared platforms, the authoritative artifact and decision owner for each layer, and every permitted forward or recovery transition. `/architecture` renders that same registry and `/api/architecture` exposes it to other clients; neither keeps a duplicate list.

Every customer request receives one stable `WorkCase` and one stable `JobOrder`. The WorkCase carries its current L01–L13 position and an optimistic state version. A layer can advance only when the expected version is current, the owning authority acts, and a version-bound artifact authorizes the transition. Each transition is appended to `domain_events`; the UI never owns progression.

The planning engine actively implements L01 Intake & Context and L02 Intelligence & Planning. L03–L13 are integrated as guarded control contracts and can be filled in incrementally without changing identity or inventing parallel workflows. Creating an operational work order now links it to the existing WorkCase, JobOrder and Requirement Contract, then records the L03 governance and L04 fulfillment handoff.

Three stages run on every planning request, in this order:

**1. Architect — Gemini drafts.** Drafting is deliberately not split across model families. If Gemini is unavailable or fails, the deterministic rule-based planner takes over: a narrower plan, but a predictable one. No other vendor drafts.

**2. Deterministic core — always runs.** The rules gate and job intelligence execute regardless of which architect produced the draft, and regardless of whether any model ran at all. This is where the product's actual guarantees live.

**3. Independent validation — parallel, flag-only.** Grok, OpenAI and Claude review the finished plan against the customer's original words, concurrently and independently. They flag; they never rewrite. If any validator that ran rejects the plan, the audit status is marked `corrected` so a human sees that something needs a second look.

The value is in stage 2. Models are replaceable; the rules, schemas, ontology and accumulated execution data are not.

## Layout

```
app/
  page.tsx              customer experience
  _domain/              plan types, executor pool, option building, formatting
  _components/          shared UI pieces
  provider/             executor portal
  track/                live execution tracker
  data/                 data inspection surface
  api/plan/             planning endpoint (architect → rules gate → validation)
  api/operations/       work orders, assignments, equipment, rentals
  api/route/            Google Routes proxy
  api/architecture/     canonical architecture registry
  architecture/         visible L01–L13 / P01–P09 operating map
lib/                    the intelligence engine — no framework dependencies
db/                     Drizzle schema and the D1 binding
drizzle/                generated migrations
worker/                 Cloudflare Worker entry point
tests/                  engine and schedule test suites
scripts/                Sites lifecycle helpers
```

### `lib/` — the engine

`lib/` has no framework dependencies and runs standalone under `node --test`. That property is what made the v36 source recovery verifiable, and it is worth preserving: the engine should never need Next, React or Cloudflare to execute.

| File | Role |
|---|---|
| `work-ontology.ts` | 12 work domains, qualification tiers, phase definitions, resource catalog |
| `planner.ts` | Types and deterministic primitives — schedule, route, access, addresses, safety |
| `household-catalog.ts` | Household item recognition and item-specific questions |
| `job-intelligence.ts` | Assembles the full job intelligence object |
| `rules-gate.ts` | The rules gate |
| `work-orders.ts` | Work-order payload and persistence |
| `canonical-architecture.ts` | Master L01–L13/P01–P09 registry, ownership and transition graph |

### The rules gate

`applyDoneeoRulesGate()` evaluates ten domains — request, scope, locations, people, equipment, safety, schedule, routing, commercial, execution — and carries eight safeguards on every run, including: lock customer-supplied facts and never ask for them again; produce no matching, route, time or price until required facts are complete; require customer approval before extra work or added charges.

The gate exists to prevent regression. When fixing a bug it exposes, fix the general rule, not the specific scenario — and add a test that would have caught it.

## Tests

```bash
node --import tsx --test tests/job-intelligence.test.ts
node --import tsx --test tests/preparation-schedule.test.ts
```

`tests/job-intelligence.test.ts` protects the behaviors the gate exists to enforce: same-property work never invents a van or a route, composite orders stay composite, regulated work cannot be matched to a general helper, a simple bulb change is not treated like circuit work, supplied facts remove only the questions they answer, arrival commitment stays separate from completion deadline.

`tests/preparation-schedule.test.ts` covers backward-scheduled preparation — preparation never pushes arrival later.

Do not overfit to the scenario that exposed a bug. Test across varied realistic jobs with different constraints.

## Data model

Twenty tables in D1/SQLite. The parts worth knowing:

- `work_orders.status` walks `draft → matching → team_pending → equipment_check → ready → in_progress → awaiting_customer → completed`, plus `rematching`.
- `work_order_stops` makes each stop a stateful object with its own `access_json` — access is per stop, never global to the order.
- `equipment_responses` records `profile_listed` alongside the answer, so a provider is never asked to reconfirm equipment their profile already lists.
- `work_order_events` is the audit log for arrival, milestones, delays and scope changes.
- `work_cases.current_layer_id` is the canonical L01–L13 position; `state_version` protects it from stale commands.
- `work_orders.work_case_id`, `job_order_id` and `requirement_contract_ref` link operations to the master control record instead of duplicating identity.
- `domain_events` is the append-only control ledger for layer progression and versioned gate artifacts.

## Provenance

The canonical source was recovered in August 2026 from the `doneeo-intelligence` ChatGPT/Codex Sites export (36 iterations, Aug 7–12, 2026), replacing an earlier standalone Python prototype. See `RECOVERY_NOTES.md`.

22 binary assets — fonts under `.vinext/fonts/` and brand images under `public/brand/` — are referenced but not yet retrieved from the companion export ZIP.
