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
