/**
 * Idempotent retry of a whole command chain.
 *
 * Four independent sources assert this property:
 *
 *   P1-G1   "Duplicate payment command no duplicate capture"
 *   L12-G3  "Lost callback replay causes no duplicate financial effect"
 *   P6-G3   "Lost callback replay remains idempotent"
 *   P1 board "Idempotent by Design — every command safe to retry",
 *            restated as "safe replay handling" and "exactly-once effect guarantee"
 *
 * P6 raises it to a coherence invariant: "at-least-once delivery + idempotent
 * consumers + transactional inbox/outbox". It is not a nice-to-have. Physical
 * work is forward-only, and a duplicated command downstream means a second crew
 * at someone's door.
 *
 * It did not hold. Each command replayed correctly in isolation, and the suite
 * was green, because every test retried one command rather than the chain. The
 * failure only appears when the whole operation is retried:
 *
 *   first   receive -> v1   arch -> v2   ready -> v3
 *   retry   receive replays and returns CURRENT state (v3), so the next command
 *           in the chain is issued with expectedVersion 3 where the original
 *           used 1 — and expectedVersion was hashed into the idempotency key,
 *           so an identical retry looked like a different command and threw.
 *
 * The fix is a distinction the original conflated: the idempotency key
 * identifies WHAT the command is; expectedVersion is the concurrency
 * precondition for WHEN it may apply. Only the former belongs in the request
 * hash. Reuse of a key with genuinely different material input still fails
 * closed, and a genuinely stale command still trips assertExpectedVersion.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { WorkCaseService } from "../lib/application/work-case-service";
import type { WorkCaseControlState } from "../lib/work-case";
import type { TaskIdentity } from "../lib/intelligence-task-identity";
import type { StoredCommand } from "../lib/application/requirement-contract-store";
import type { WorkCaseEvent, WorkCaseStore } from "../lib/application/work-case-store";

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
const T = ["2026-08-24T10:00:00.000Z", "2026-08-24T10:00:01.000Z", "2026-08-24T10:00:02.000Z"] as const;
const REQUEST = "Move my couch to the third floor";
const TASKS = [{ title: "Move couch", domain: "transport_handling", ordinal: 1 }];

/** The whole operation under one request id, exactly as a route would issue it. */
async function runChain(svc: WorkCaseService, R: string) {
  const a = await svc.receiveRequest({
    commandKey: `${R}:receive`, rawRequest: REQUEST, correlationId: `plan:${R}`, now: T[0],
  });
  const b = await svc.recordArchitecture({
    commandKey: `${R}:architecture`, workCaseId: a.workCase.workCaseId,
    expectedVersion: a.workCase.stateVersion, taskCandidates: TASKS,
    correlationId: `plan:${R}`, now: T[1],
  });
  const c = await svc.requirementReady({
    commandKey: `${R}:ready`, workCaseId: a.workCase.workCaseId,
    expectedVersion: b.workCase.stateVersion, requirementContractRef: "JO-1@1",
    correlationId: `plan:${R}`, now: T[2],
  });
  return { a, b, c };
}

test("an identical retry of the whole chain replays instead of failing", async () => {
  const store = new MemoryStore();
  const svc = new WorkCaseService(store, ids());

  const first = await runChain(svc, "req-1");
  assert.equal(first.c.workCase.state, "REQUIREMENT_READY");
  const versionAfterFirst = first.c.workCase.stateVersion;
  const casesAfterFirst = store.cases.size;
  const eventsAfterFirst = store.events.length;

  // The same request id again — a client retry, a lost response, an at-least-once
  // delivery. This must replay, not throw and not re-execute.
  const retry = await runChain(svc, "req-1");

  assert.equal(retry.a.replayed, true, "receive must replay");
  assert.equal(retry.b.replayed, true, "architecture must replay");
  assert.equal(retry.c.replayed, true, "requirement-ready must replay");
  assert.equal(store.cases.size, casesAfterFirst, "a retry created another WorkCase");
  assert.equal(store.events.length, eventsAfterFirst, "a retry emitted duplicate events");
  assert.equal(retry.c.workCase.stateVersion, versionAfterFirst, "a retry advanced the state");
  assert.equal(retry.a.workCase.workCaseId, first.a.workCase.workCaseId);
});

test("reusing a key with genuinely different input still fails closed", async () => {
  // The guard that must survive the fix. Same key, different material input is
  // a client error, not a retry — and physical work makes silently accepting it
  // far worse than rejecting it.
  const store = new MemoryStore();
  const svc = new WorkCaseService(store, ids());
  const a = await svc.receiveRequest({ commandKey: "k:receive", rawRequest: REQUEST, correlationId: "c", now: T[0] });
  await svc.recordArchitecture({
    commandKey: "k:arch", workCaseId: a.workCase.workCaseId, expectedVersion: 1,
    taskCandidates: TASKS, correlationId: "c", now: T[1],
  });
  await assert.rejects(
    () => svc.recordArchitecture({
      commandKey: "k:arch", workCaseId: a.workCase.workCaseId, expectedVersion: 1,
      taskCandidates: [{ title: "Something else entirely", domain: "cleaning", ordinal: 1 }],
      correlationId: "c", now: T[1],
    }),
    /reused with different/i,
    "a key reused with different material input must be refused",
  );
});

test("a genuinely stale command is still rejected", async () => {
  // Removing expectedVersion from the idempotency key must not weaken optimistic
  // concurrency. A different command arriving with a stale expected version is
  // still refused by the domain, which is where that check belongs.
  const store = new MemoryStore();
  const svc = new WorkCaseService(store, ids());
  const a = await svc.receiveRequest({ commandKey: "s:receive", rawRequest: REQUEST, correlationId: "c", now: T[0] });
  await svc.recordArchitecture({
    commandKey: "s:arch1", workCaseId: a.workCase.workCaseId, expectedVersion: 1,
    taskCandidates: TASKS, correlationId: "c", now: T[1],
  });
  await assert.rejects(
    () => svc.recordArchitecture({
      commandKey: "s:arch2", workCaseId: a.workCase.workCaseId, expectedVersion: 1,
      taskCandidates: TASKS, correlationId: "c", now: T[2],
    }),
    (e: unknown) => (e as { invariant?: string }).invariant === "STALE_COMMAND",
    "a second command against v1 must be refused once the case is at v2",
  );
});

test("retrying only part of the chain is also safe", async () => {
  // At-least-once delivery does not politely retry whole operations.
  const store = new MemoryStore();
  const svc = new WorkCaseService(store, ids());
  const a = await svc.receiveRequest({ commandKey: "p:receive", rawRequest: REQUEST, correlationId: "c", now: T[0] });
  const b1 = await svc.recordArchitecture({
    commandKey: "p:arch", workCaseId: a.workCase.workCaseId, expectedVersion: 1,
    taskCandidates: TASKS, correlationId: "c", now: T[1],
  });
  const b2 = await svc.recordArchitecture({
    commandKey: "p:arch", workCaseId: a.workCase.workCaseId, expectedVersion: b1.workCase.stateVersion,
    taskCandidates: TASKS, correlationId: "c", now: T[1],
  });
  assert.equal(b2.replayed, true);
  assert.equal(b2.workCase.stateVersion, b1.workCase.stateVersion, "a partial retry advanced the state");
  assert.equal(store.events.length, 2, "a partial retry emitted a duplicate event");
});
