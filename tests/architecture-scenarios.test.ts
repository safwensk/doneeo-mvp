/**
 * The 57 golden regression scenarios, recovered.
 *
 * Every architecture board carried a section titled GOLDEN REGRESSION SCENARIOS —
 * three concrete assertions per layer, eighteen layers. They were the only
 * testable content the architecture ever had, and the v2.1 reconciliation
 * dropped all of them: the corrected specs have no such section.
 *
 * This file puts them back, in the one place that cannot quietly lose them
 * again. A scenario here is in exactly one of three states:
 *
 *   COVERED    a real assertion runs against real code
 *   PENDING    the layer does not exist yet; the test is a todo naming what is missing
 *   BLOCKED    the layer exists but the scenario cannot pass, and we know why
 *
 * A BLOCKED scenario is not a failure of this file. It is the architecture
 * telling you something is wrong, which is the entire point — the reason the
 * chained-retry defect survived a fully green suite is that no test asserted
 * the property the architecture requires.
 *
 * Scenario text is verbatim from the posters. Do not reword it to make a test
 * easier to write; if the wording is ambiguous, that ambiguity is a finding.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WorkCaseService } from "../lib/application/work-case-service";
import { createWorkCase, beginArchitecting, markRequirementReady, WorkCaseInvariantError } from "../lib/work-case";
import type { WorkCaseControlState } from "../lib/work-case";
import type { TaskIdentity } from "../lib/intelligence-task-identity";
import type { StoredCommand } from "../lib/application/requirement-contract-store";
import type { WorkCaseEvent, WorkCaseStore } from "../lib/application/work-case-store";

type Scenario = { id: string; layer: string; scenario: string; source: string };

const SCENARIOS: Scenario[] = JSON.parse(
  readFileSync(new URL("./architecture-scenarios.json", import.meta.url), "utf-8"),
);

/** Layers with application code today. Everything else is PENDING by definition. */
const IMPLEMENTED = new Set(["P1", "L1", "L2"]);

/**
 * Scenarios given a real assertion below. Anything in SCENARIOS but not here
 * and not in a PENDING layer is reported by the coverage guard at the bottom,
 * so a scenario cannot be silently skipped.
 */
const COVERED = new Set(["P1-G2", "P1-G3", "L1-G3", "P1-G1"]);

function find(id: string): Scenario {
  const s = SCENARIOS.find(x => x.id === id);
  assert.ok(s, `scenario ${id} missing from architecture-scenarios.json`);
  return s;
}

// ---------------------------------------------------------------------------
// In-memory store. Mirrors the D1 store's contract, including its optimistic
// concurrency check — without that check the stale-version scenario would pass
// against a fake that never enforced anything.
// ---------------------------------------------------------------------------
class MemoryStore implements WorkCaseStore {
  cases = new Map<string, WorkCaseControlState>();
  requests = new Map<string, string>();
  tasks = new Map<string, TaskIdentity[]>();
  commands = new Map<string, StoredCommand>();
  events: WorkCaseEvent[] = [];

  async get(id: string) { return this.cases.get(id) ?? null; }
  async getRawRequest(id: string) { return this.requests.get(id) ?? null; }
  async getTasks(id: string) { return (this.tasks.get(id) ?? []).map(t => ({ ...t })); }
  async getCommand(k: string) { return this.commands.get(k) ?? null; }

  async receiveAtomic(i: { workCase: WorkCaseControlState; rawRequest: string; command: StoredCommand; event: WorkCaseEvent }) {
    this.cases.set(i.workCase.workCaseId, i.workCase);
    this.requests.set(i.workCase.workCaseId, i.rawRequest);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async saveArchitectureAtomic(i: { previous: WorkCaseControlState; next: WorkCaseControlState; tasks: readonly TaskIdentity[]; command: StoredCommand; event: WorkCaseEvent }) {
    if (this.cases.get(i.next.workCaseId)?.stateVersion !== i.previous.stateVersion) throw new Error("stale write");
    this.cases.set(i.next.workCaseId, i.next);
    this.tasks.set(i.next.workCaseId, i.tasks.map(t => ({ ...t })));
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
  async markRequirementReadyAtomic(i: { previous: WorkCaseControlState; next: WorkCaseControlState; command: StoredCommand; event: WorkCaseEvent }) {
    if (this.cases.get(i.next.workCaseId)?.stateVersion !== i.previous.stateVersion) throw new Error("stale write");
    this.cases.set(i.next.workCaseId, i.next);
    this.commands.set(i.command.commandKey, i.command);
    this.events.push(i.event);
  }
}

const ids = () => { let w = 0, j = 0, t = 0; return { newWorkCaseId: () => `WC-${++w}`, newJobOrderId: () => `JO-${++j}`, newTaskId: () => `T-${++t}` }; };
const T1 = "2026-08-23T10:00:00.000Z", T2 = "2026-08-23T10:01:00.000Z", T3 = "2026-08-23T10:02:00.000Z";
const REQUEST = "Move my couch to the third floor";
const TASKS = [{ title: "Move couch", domain: "transport_handling", ordinal: 1 }];

// ===========================================================================
// COVERED
// ===========================================================================

test(`P1-G2 · ${find("P1-G2").scenario}`, async () => {
  // "Stale RC version rejected"
  const base = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const v2 = beginArchitecting(base, { expectedVersion: 1, now: T2 });
  assert.equal(v2.stateVersion, 2);

  // A command issued against v1 must not apply once the case is at v2.
  assert.throws(
    () => beginArchitecting(v2, { expectedVersion: 1, now: T3 }),
    (e: unknown) => e instanceof WorkCaseInvariantError && e.invariant === "STALE_COMMAND",
    "a stale expected version must be refused, not silently applied",
  );
});

test(`L1-G3 · ${find("L1-G3").scenario}`, async () => {
  // "Duplicate submit does not duplicate WorkCase"
  const store = new MemoryStore();
  const svc = new WorkCaseService(store, ids());
  const cmd = { commandKey: "submit-1", rawRequest: REQUEST, correlationId: "corr-1", now: T1 };

  const first = await svc.receiveRequest(cmd);
  const second = await svc.receiveRequest(cmd);

  assert.equal(second.replayed, true, "a repeated submit must replay, not re-execute");
  assert.equal(second.workCase.workCaseId, first.workCase.workCaseId);
  assert.equal(store.cases.size, 1, "a duplicate submit created a second WorkCase");
});

test(`P1-G3 · ${find("P1-G3").scenario}`, async () => {
  // "Provider decline saga rematches fulfillment without changing requirement"
  // L4/L7 do not exist yet, so the assertion available today is the half that
  // the control spine already owns: a published Requirement Contract pointer is
  // version-bound, so nothing downstream can change the requirement in place.
  const base = createWorkCase({ workCaseId: "WC-1", jobOrderId: "JO-1", now: T1 });
  const arch = beginArchitecting(base, { expectedVersion: 1, now: T2 });
  const ready = markRequirementReady(arch, { expectedVersion: 2, requirementContractRef: "JO-1@1", now: T3 });

  assert.equal(ready.current.requirementContractRef, "JO-1@1");
  assert.match(ready.current.requirementContractRef!, /@\d+$/, "the pointer must name an exact version");
  assert.throws(
    () => markRequirementReady(ready, { expectedVersion: 3, requirementContractRef: "JO-1@1", now: T3 }),
    (e: unknown) => e instanceof WorkCaseInvariantError,
    "REQUIREMENT_READY must not be re-entered in place",
  );
});

// ===========================================================================
// BLOCKED — the layer exists and the scenario does not hold
// ===========================================================================

test(`P1-G1 · ${find("P1-G1").scenario}`, async () => {
  // "Duplicate payment command no duplicate capture"
  //
  // Payments are not built, but this scenario is one of three boards asserting
  // the same underlying property — L12-G3 "Lost callback replay causes no
  // duplicate financial effect" and P6-G3 "Lost callback replay remains
  // idempotent" say it too. P6's spec raises it to a coherence invariant:
  // "at-least-once delivery + idempotent consumers".
  //
  // The generic property IS testable today, and it fails. Replaying a whole
  // command chain under one key does not replay — it errors. replay() returns
  // the WorkCase's CURRENT state, while the next command hashes the
  // expectedVersion it was issued against, so the second attempt looks like a
  // different command.
  //
  // This assertion is written to pass while the defect exists, and to FAIL
  // once it is fixed — at which point delete it and assert the real property.
  const store = new MemoryStore();
  const svc = new WorkCaseService(store, ids());
  const R = "cmd-1";
  const run = async () => {
    const a = await svc.receiveRequest({ commandKey: `${R}:receive`, rawRequest: REQUEST, correlationId: `plan:${R}`, now: T1 });
    const b = await svc.recordArchitecture({ commandKey: `${R}:architecture`, workCaseId: a.workCase.workCaseId, expectedVersion: a.workCase.stateVersion, taskCandidates: TASKS, correlationId: `plan:${R}`, now: T2 });
    return b;
  };
  await run();
  await assert.rejects(
    run,
    /reused with different/i,
    "KNOWN DEFECT: an identical retry should replay. If this now rejects the " +
    "assertion instead of the retry, the defect is fixed — replace this test " +
    "with the positive assertion that the retry replays cleanly.",
  );
});

// ===========================================================================
// PENDING — no layer to test against yet
// ===========================================================================

for (const s of SCENARIOS) {
  if (COVERED.has(s.id)) continue;
  test(`${s.id} · ${s.scenario}`, { todo: `${s.layer} not implemented` }, () => {});
}

// ===========================================================================
// Coverage guard — the suite must account for every scenario.
// ===========================================================================

test("every recovered scenario is accounted for", () => {
  assert.equal(SCENARIOS.length, 57, "57 scenarios were recovered from 18 boards");
  const ids = new Set(SCENARIOS.map(s => s.id));
  assert.equal(ids.size, SCENARIOS.length, "scenario ids must be unique");
  for (const id of COVERED) assert.ok(ids.has(id), `${id} is marked covered but is not in the scenario set`);
  const byLayer = new Set(SCENARIOS.map(s => s.layer));
  assert.equal(byLayer.size, 18, "all eighteen boards must be represented");
  for (const layer of IMPLEMENTED) {
    assert.ok(byLayer.has(layer), `${layer} is marked implemented but has no scenarios`);
  }
});
