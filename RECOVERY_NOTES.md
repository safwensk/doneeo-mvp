# Recovery notes — v36 canonical import (Aug 13, 2026)

This commit replaces the earlier standalone Python prototype with the real
canonical source, recovered from the `doneeo-intelligence` ChatGPT/Codex
Sites export (36 iterations, Aug 7–12, 2026).

- 58/58 text source files recovered and verified.
- Core intelligence engine (`lib/planner.ts`, `lib/job-intelligence.ts`,
  `lib/rules-gate.ts`, `lib/work-ontology.ts`, `lib/household-catalog.ts`)
  has no framework dependencies and was run standalone: **37/37 tests
  passing** (`tests/job-intelligence.test.ts`).
- **Missing:** 22 binary assets (fonts under `.vinext/fonts/`, product/pitch
  images under `public/brand/`) referenced by the export but not included in
  the uploaded source dump — they live in a companion ZIP from the same
  Sites export that hasn't been retrieved yet. Everything else is complete.
- Stack: Next.js 16 / React 19 on Cloudflare via `vinext`, Drizzle ORM + D1,
  hosted through OpenAI's ChatGPT Sites platform.

The 37 tests are 26 written literally plus 11 generated from two scenario
tables (`domainScenarios`, 6 · `onePropertyRelevanceScenarios`, 5). Counting
`test("` occurrences undercounts the suite — run it rather than grep it.

## Changes since import

**Aug 16, 2026** — Grok and OpenAI were removed as emergency fallback
drafters in `app/api/plan/route.ts`. Gemini is the sole architect; the
deterministic planner is the only fallback. All three external models
remain as parallel, flag-only validators downstream.

**Aug 16, 2026** — `tests/preparation-schedule.test.ts` (10 tests covering
backward-scheduled preparation) was added to the `npm test` script. It
existed but was never run by the standard command.

**Aug 16, 2026** — `app/page.tsx` reduced from ~136 KB to ~104 KB by moving
plan types, the executor pool, option building, formatting helpers and the
`Question` component into `app/_domain/` and `app/_components/`. The `Home`
component body is unchanged.
