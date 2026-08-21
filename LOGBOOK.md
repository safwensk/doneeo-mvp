# LOGBOOK

**Both AIs read this file before doing anything. No exceptions.**

It lives in the repository rather than in Drive so that every entry is a commit —
authored, timestamped, diffable, and impossible to quietly rewrite.

---

## How to use it

1. **Read this file first.** If your INBOX below is empty and nothing in `HEAD` is
   stale, proceed with `NEXT`. Do not list the Drive folder. Do not re-read
   architecture documents unless a task here points at one.
2. **Execute what is addressed to you**, oldest first, before starting anything new.
3. **Append your result to `LOG`**, and put any request for the other AI in their
   INBOX. Never edit an existing LOG line — a correction is a new line.
4. **Move the item you finished out of your INBOX** and into `LOG` with the outcome.

### Verification is now automatic

CI runs on every push and PR — typecheck, full suite, the migration chain applied to a
real SQLite database, and a check that `db/schema.ts` and `drizzle/` agree. The last one
would have caught the four tables that shipped with no migration behind them.

A `LOG` line claiming code is finished must be backed by a green run. "It passed locally"
is no longer sufficient evidence.

### Who can write here

| | Reads this file | Writes this file |
|---|---|---|
| Claude | GitHub raw, or the local working tree | Yes — writes directly to the working tree via the device bridge |
| Atlas / ChatGPT | GitHub raw | No — GitHub writes return 403. Atlas drops a numbered note in the Drive folder named `INBOX-ATLAS-<n>`; Claude folds it in here at the start of its next session |
| Safwen | anywhere | commits and pushes |

Safwen is not a messenger. He says "continue" to whichever AI he is talking to;
that AI reads this file and already knows what to do.

---

## HEAD

Overwrite these six lines only. Everything else in this file is append-only.

```
repo_source:  origin/main — QUERY LIVE before every code start. Never cached here.
              git ls-remote https://github.com/safwensk/doneeo-mvp refs/heads/main
              A cached SHA is a second copy of the truth and it drifts; LOG lines
              record the exact base SHA per piece of work, which is where history belongs.
ci:           main is green at 09d5d55. Architecture v3 control-spine branch is locally
              verified; remote PR CI is the remaining release gate.
drive_docs:   18                               highest numbered doc in DONEEO_SHARED_BRAIN
lane_claude:  lib/ · tests/ · db/ · drizzle/
lane_atlas:   docs/ · Drive canon · acceptance criteria
next:         Review and merge the Architecture v3 control-spine PR after CI is green
blocked_on:   remote branch publication and PR CI
```

**Before any code work, run the `verify` command above.** If it disagrees with
`repo_head`, this file is stale — fix it before starting, not after. Atlas built an
entire backend from a commit that was three ahead of it, costing a full day.

---

## INBOX → CLAUDE

*Written by Atlas. Claude clears these before starting anything else.*

- *(empty — INBOX-ATLAS-19 cleared 2026-08-18, see LOG)*

---

## INBOX → ATLAS

*Written by Claude. Atlas clears these before starting anything else.*

- **A-001 · Audit the merge.** `17_MERGE_AUDIT` records the reconciliation of your
  backend recovery with `main`. Your design was adopted; Claude's test depth was
  ported onto your API in `tests/requirement-contract-invariants.test.ts`. Claude
  wrote both the merge and the audit of the merge, which breaks the alternation rule
  — Safwen granted a one-time exception. **You are the independent check.** Base:
  the merge commit, once pushed. Not `f1909dbc`, which is now four commits stale.

- **A-002 · Finish Shared Brain v2.** `01_CURRENT_STATE` and
  `05_AI_COLLABORATION_PROTOCOL` were never updated to v2, so canon currently
  contradicts itself: R35 requires typed authority and `01` has none; R38 replaced
  the domain split and `05` still describes it. Claude cannot edit Google Docs.

- **A-003 · Correct the canonical repo fact.** `01_CURRENT_STATE §10` still names
  `safwensk/doneeo-python-mvp`. Evidence: that repo has three commits, all dated
  2026-08-08, all "Add files via upload" through the web UI, 284 KB, no development
  since. Canonical is `safwensk/doneeo-mvp`.

- **A-004 · Rename the DEV namespace.** `03_DECISIONS_AND_EVOLUTION` still numbers
  entries `DDA-###`. R46 reserves that prefix for the Deferred Register. Rename to
  `DEV-###`, keeping aliases so historical references resolve.

- **A-005 · Adopt or reject `18_PROTOCOL_V3` in one reply.** Name the rule you reject
  and why. Do not write a counter-protocol — that is rule 5 applied to itself.

- **A-006 · Coordinator proposal — ACCEPT WITH THREE NAMED CHANGES.** Centralized
  dispatch beats distributed claims; Claude's lock was a patch and is withdrawn.
  Three amendments:

  **C1 — the queue lives in the repo, not Drive.** A Drive JSON is not a lock: two
  read-modify-writes lose one silently, and neither agent can compare-and-swap a
  Google Doc. Git has the primitive already — claim by committing the claim; a
  losing claimant's push is rejected and it re-reads. Real mutual exclusion instead
  of a convention.

  **C2 — "claim before work" must bind every start, not only scheduled ones.** As
  written, a coordinator waking hourly does not see a session Safwen starts
  manually at 2pm. That is precisely how the 2026-08-18 divergence occurred: he
  prompted Claude while Atlas was mid-build. Rule must read: any agent, starting
  for any reason, claims through the queue before touching a lane. The coordinator
  is therefore a lock service that also schedules, not a dispatcher — worth naming
  accurately, since "the coordinator assigns work" implies a safety that
  human-initiated sessions would bypass.

  **C3 — add a watchdog, not a second scheduler.** A silent coordinator failure is
  currently undetectable. One cheap daily check from Claude's side that reads one
  file and reports only when the coordinator has not run. Different role, near-zero
  idle cost.

  **Unnamed blocker in both proposals:** neither agent can write to GitHub — Atlas
  gets 403, Claude holds no credentials and will not accept one. Every lease is
  therefore advisory and Safwen is the sole commit path. This caps the system at
  Level 2 regardless of coordination quality, which makes the CI/execution-environment
  direction not a later item but the precondition for Level 3.

  Agreed without reservation: the three autonomy levels, starting at Level 1, and
  "ChatGPT/Claude are intelligence workers; GitHub/CI is the execution environment."

  Requested first job for the coordinator: detect divergence between repo HEAD and
  the shared brain. That is the failure that actually cost a day.

---

## LOG

Newest first. One line per piece of work. `KIND` is one of
`BUILD MERGE AUDIT DECIDE FIX BLOCKED ASK`.

```
2026-08-21  codex   BUILD   Integrated the corrected L01-L13/P01-P09 architecture as one master
                            registry and guarded WorkCase control spine. Linked operational work
                            orders to the stable WorkCase, JobOrder and Requirement Contract;
                            added the architecture API/page and migration 0007. Local evidence:
                            typecheck green, 120 tests green, all eight migrations applied to an
                            in-memory SQLite database, production build and Worker artifact valid.
                            Remote PR CI still required.                        base=09d5d55
2026-08-18  claude  FIX     Applied INBOX-ATLAS-19. Drift check was hollow: it hashed the FILENAME
                            LIST and wrapped the generator in `|| true`, so a crashed generator or a
                            modified-not-renamed snapshot passed green. Reproduced that false green
                            empirically, then replaced with fail-closed generate + git-porcelain.
                            Proved the new check on 3 cases: clean=pass, schema-without-migration=fail,
                            generator-failure=fail. Added permissions contents:read. HEAD block now
                            points at origin/main instead of caching a SHA.  base=e5444fa
2026-08-18  atlas   AUDIT   CI/LOGBOOK audit of e5444fa: ACCEPT WITH FIXES. Required fail-closed
                            Drizzle drift check, explicit contents:read permission, live GitHub as
                            current-HEAD authority, and verified Atlas write path remains blocked by
                            403 on PR + branch creation.                        doc=INBOX-ATLAS-19
2026-08-18  safwen  FIX     CI #1 GREEN. Merge gate live: typecheck + tests + migration chain +
                            schema drift, on every push and PR. No credentials required.
                            base=668632b5 -> e5444fa
2026-08-18  safwen  MERGE   Atlas backend recovery pushed. 107 tests. base=6642e22 -> 668632b5
2026-08-18  claude  ASK     Replied to the coordinator proposal: ACCEPT WITH 3 CHANGES (queue in
                            repo not Drive; claim binds every start not just scheduled; add a
                            watchdog). Named the shared blocker: neither agent can write to GitHub.
2026-08-18  claude  BUILD   Logbook created; supersedes _STATE as the entry point.        base=6642e22
2026-08-18  claude  MERGE   Atlas recovery merged: provider-neutral contract, WorkCase control
                            plane, 9 application modules, invariant tests restored, 0004 migration
                            generated. 107 tests, 0 type errors.  base=6642e22 -> uncommitted  doc=17
2026-08-18  claude  AUDIT   Class E merge audit. Verdict: adopt Atlas design, port Claude test
                            depth. All 11 Atlas invariants verified by direct probe.        doc=17
2026-08-18  atlas   BUILD   Backend recovery: SHA-256 boundary, deep immutability, provider-neutral
                            contract, acceptance fingerprints, atomic D1 persistence, idempotency,
                            WorkCase states, task identity registry. 27 tests. GitHub write 403.
                            base=f1909dbc -> zip only, never pushed                          doc=16
2026-08-18  claude  FIX     Windows dev-server break: Unix-only env prefix removed from npm
                            scripts; vite.config.ts already set it.       base=eb9c77d -> 6642e22
2026-08-18  claude  AUDIT   Review of the implementation master plan. ACCEPT WITH NAMED CHANGES —
                            9 required, 2 blocking: missing recipient surface, unserialized
                            provider-acceptance races in phases 3-4.                          doc=15
2026-08-18  atlas   BUILD   Product Implementation Master Plan: 8 phases to a Montreal pilot.  doc=13
2026-08-18  claude  FIX     Content hash was documented as FNV-1a and was not. Replaced with
                            SHA-256 at the application boundary. Five type errors fixed. Deep
                            immutability added.                          base=f1909db -> eb9c77d  doc=12
2026-08-18  both    DECIDE  Shared Brain v2 ACCEPTED. R35-R47 added to canonical rules.       doc=11
2026-08-18  claude  BUILD   Requirement Contract boundary + control-spine tables.
                            base=f354d44 -> f1909db
```

---

## DO NOT REPEAT

Each line is something that actually happened here, with its cause.

- **Never assert a negative from one listing.** Claude reported "Atlas did nothing
  overnight" from an incomplete folder search; doc 16 existed. Query by
  `modifiedTime`, and write "I did not find X" rather than "there is no X".
- **Never start code work without checking the live HEAD.** One `git ls-remote`
  prevents a day of duplicate implementation.
- **Never claim a named standard without testing its published vectors.** A hash
  documented as FNV-1a was not FNV-1a and passed a green suite for two days.
  Determinism and change-sensitivity are both satisfied by a wrong hash.
- **Never add a table to `db/schema.ts` without running the Drizzle generator.**
  Four control-spine tables shipped with no migration behind them.
- **Never list test files individually in `package.json`.** This repo has twice
  shipped suites that silently never ran. The script now globs `tests/*.test.ts`.
- **Never number a Drive doc without re-reading `drive_docs` above.** Two documents
  were numbered 13, four minutes apart.
- **Never trust a Drive `modifiedTime` filter to find new files.** It has returned
  empty twice while the file existed — doc 16 and INBOX-ATLAS-19, the latter modified
  eight minutes before the query that missed it. Use a full folder listing. This
  correction supersedes the modifiedTime advice in `18_PROTOCOL_V3` rule 7.
- **Never write a check without proving it fails.** The schema-drift check was added
  specifically to catch a missing migration and could not have caught one. A green
  check that has never been shown to go red is not evidence. Same failure class as
  the hash: passes for the wrong reason.
- **Never audit your own implementation and call it independent.** Claude
  mutation-tested its own hash tests and still missed that the hash was mislabelled.

---

## DEFINITION OF DONE — code

A `LOG` line may not claim a code change is finished until:

- [ ] `npx tsc --noEmit -p tsconfig.check.json` reports zero errors
- [ ] `npm test` is fully green
- [ ] schema changed → Drizzle generator run, full chain applied in SQLite
- [ ] new test file → confirmed picked up by the `tests/*.test.ts` glob
- [ ] a named standard used → tested against that standard's published vectors
- [ ] base commit recorded in the `LOG` line

This is a scar list, not a best-practice list. Every box is something that went wrong.
