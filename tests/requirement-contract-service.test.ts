import test from "node:test";
import assert from "node:assert/strict";

import type { RequirementContract, TaskBlockLifecycleIdentity } from "../lib/requirement-contract";
import { assignFulfillment, beginExecution } from "../lib/requirement-contract";
import { RequirementContractService, IdempotencyKeyReuseError } from "../lib/application/requirement-contract-service";
import type { AtomicPublishWrite, AtomicSupersedeWrite, RequirementContractStore, StoredCommand } from "../lib/application/requirement-contract-store";
import type { JobIntelligence } from "../lib/planner";
import type { TaskBlockAcceptanceProjection } from "../lib/application/requirement-contract-hashing";

function plan(label = "base"): JobIntelligence {
  return {
    version: "1",
    facts: [], primitives: [], resources: [], workstreams: [],
    fulfillment: { mode: "single_team", singleCustomerOrder: true, rationale: "one team", groups: [] },
    manpower: { minimum: 2, recommended: 2, reason: label, alternatives: [] },
    estimate: { ready: true, personMinutes: 120, executionMinutes: 60, accessMinutes: 10, routeMinutes: 0, bufferMinutes: 15, totalMinutes: 85, rangeLow: 70, rangeHigh: 100, equation: "work + access + buffer", assumptions: [] },
    confidence: { level: "high", score: 90, reason: label }, unresolved: [],
  } as JobIntelligence;
}

function task(requirementId: string, scope: string): TaskBlockAcceptanceProjection {
  return {
    requirementId,
    scope,
    qualification: "general_helper",
    crew: { minimum: 2, recommended: 2 },
    duration: { likelyMinutes: 60 },
    equipmentAndMaterials: ["dolly"],
    accessAndLocations: ["3rd floor"],
    temporalConstraints: ["10:00 arrival"],
    dependencies: [],
    completionCriteria: ["done"],
    ruleDecisions: ["safe-lift-v1"],
  };
}

class MemoryStore implements RequirementContractStore {
  contracts = new Map<string, RequirementContract>();
  lifecycle = new Map<string, TaskBlockLifecycleIdentity[]>();
  commands = new Map<string, StoredCommand>();
  events: Array<{ streamId: string; sequence: number; eventType: string }> = [];
  publishCalls = 0;
  supersedeCalls = 0;
  failNextCommit = false;

  key(contractId: string, version: number) { return `${contractId}@${version}`; }

  async getCurrent(contractId: string) {
    const rows = [...this.contracts.values()].filter(row => row.contractId === contractId && row.status === "PUBLISHED");
    if (rows.length > 1) throw new Error("fork");
    return rows[0] ?? null;
  }
  async getVersion(contractId: string, version: number) { return this.contracts.get(this.key(contractId, version)) ?? null; }
  async getLifecycle(contractId: string, version: number) { return (this.lifecycle.get(this.key(contractId, version)) || []).map(item => ({ ...item })); }
  async getCommand(commandKey: string) { return this.commands.get(commandKey) ?? null; }

  async publishAtomic(write: AtomicPublishWrite) {
    this.publishCalls++;
    if (this.failNextCommit) { this.failNextCommit = false; throw new Error("simulated atomic failure"); }
    if (this.commands.has(write.command.commandKey)) throw new Error("duplicate command");
    if ([...this.contracts.values()].some(c => c.contractId === write.contract.contractId && c.status === "PUBLISHED")) throw new Error("current version exists");
    this.contracts.set(this.key(write.contract.contractId, write.contract.version), write.contract);
    this.lifecycle.set(this.key(write.contract.contractId, write.contract.version), write.lifecycle.map(item => ({ ...item })));
    this.commands.set(write.command.commandKey, { ...write.command });
    this.events.push({ streamId: write.event.streamId, sequence: write.event.sequence, eventType: write.event.eventType });
  }

  async supersedeAtomic(write: AtomicSupersedeWrite) {
    this.supersedeCalls++;
    if (this.failNextCommit) { this.failNextCommit = false; throw new Error("simulated atomic failure"); }
    if (this.commands.has(write.command.commandKey)) throw new Error("duplicate command");
    const currentKey = this.key(write.previous.contractId, write.previous.version);
    const current = this.contracts.get(currentKey);
    if (!current || current.status !== "PUBLISHED") throw new Error("stale write");
    if (this.contracts.has(this.key(write.next.contractId, write.next.version))) throw new Error("version collision");
    // Commit all effects together after validation, mirroring D1 batch semantics.
    this.contracts.set(currentKey, write.previous);
    this.contracts.set(this.key(write.next.contractId, write.next.version), write.next);
    this.lifecycle.set(this.key(write.next.contractId, write.next.version), write.lifecycle.map(item => ({ ...item })));
    this.commands.set(write.command.commandKey, { ...write.command });
    this.events.push({ streamId: write.event.streamId, sequence: write.event.sequence, eventType: write.event.eventType });
  }
}

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T11:00:00.000Z";

test("application publish persists contract, lifecycle, event and command as one operation", async () => {
  const store = new MemoryStore();
  const service = new RequirementContractService(store);
  const result = await service.publish({ commandKey: "cmd-1", contractId: "WC-1", content: plan(), correlationId: "corr-1", taskBlocks: [task("rq-a", "carry couch")], publishedAt: T1 });
  assert.equal(result.reference, "WC-1@1");
  assert.equal(store.publishCalls, 1);
  assert.equal(store.commands.get("cmd-1")?.status, "SUCCEEDED");
  assert.equal(store.events[0]?.eventType, "RequirementContractPublished");
  assert.equal((await store.getLifecycle("WC-1", 1))[0]?.fulfillmentId, null);
});

test("same idempotency key replays the original result without a second write", async () => {
  const store = new MemoryStore();
  const service = new RequirementContractService(store);
  const command = { commandKey: "cmd-1", contractId: "WC-1", content: plan(), correlationId: "corr-1", taskBlocks: [task("rq-a", "carry couch")], publishedAt: T1 };
  const first = await service.publish(command);
  const second = await service.publish(command);
  assert.equal(first.reference, second.reference);
  assert.equal(second.replayed, true);
  assert.equal(store.publishCalls, 1);
});

test("idempotency key reuse with different intent fails closed", async () => {
  const store = new MemoryStore();
  const service = new RequirementContractService(store);
  await service.publish({ commandKey: "cmd-1", contractId: "WC-1", content: plan(), correlationId: "corr-1", taskBlocks: [task("rq-a", "carry couch")], publishedAt: T1 });
  await assert.rejects(
    () => service.publish({ commandKey: "cmd-1", contractId: "WC-1", content: plan("different"), correlationId: "corr-1", taskBlocks: [task("rq-a", "carry sectional")], publishedAt: T1 }),
    (error: unknown) => error instanceof IdempotencyKeyReuseError,
  );
});

test("atomic failure leaves no visible partial publish", async () => {
  const store = new MemoryStore();
  store.failNextCommit = true;
  const service = new RequirementContractService(store);
  await assert.rejects(() => service.publish({ commandKey: "cmd-fail", contractId: "WC-X", content: plan(), correlationId: "corr-x", taskBlocks: [task("rq-a", "carry couch")], publishedAt: T1 }));
  assert.equal(await store.getCurrent("WC-X"), null);
  assert.equal(await store.getCommand("cmd-fail"), null);
  assert.equal(store.events.length, 0);
});

test("supersede carries acceptance only for unchanged task fingerprints", async () => {
  const store = new MemoryStore();
  const service = new RequirementContractService(store);
  await service.publish({ commandKey: "cmd-p", contractId: "WC-2", content: plan(), correlationId: "corr-1", taskBlocks: [task("rq-a", "carry couch"), task("rq-b", "mount TV")], publishedAt: T1 });
  let lifecycle = await store.getLifecycle("WC-2", 1);
  lifecycle = assignFulfillment(lifecycle, "rq-a", "flf-a");
  lifecycle = assignFulfillment(lifecycle, "rq-b", "flf-b");
  lifecycle = beginExecution(lifecycle, "rq-b", "exe-b");
  store.lifecycle.set("WC-2@1", lifecycle);

  const result = await service.supersede({ commandKey: "cmd-s", contractId: "WC-2", content: plan("larger item"), correlationId: "corr-2", reason: "customer corrected size", taskBlocks: [task("rq-a", "carry sectional"), task("rq-b", "mount TV")], publishedAt: T2 });
  assert.equal(result.reference, "WC-2@2");
  assert.equal(result.lifecycle.find(item => item.requirementId === "rq-a")?.fulfillmentId, null);
  assert.equal(result.lifecycle.find(item => item.requirementId === "rq-b")?.fulfillmentId, "flf-b");
  assert.equal(result.lifecycle.find(item => item.requirementId === "rq-b")?.executionId, "exe-b");
  assert.equal((await store.getVersion("WC-2", 1))?.status, "SUPERSEDED");
  assert.equal((await store.getCurrent("WC-2"))?.version, 2);
  assert.equal(store.events.at(-1)?.sequence, 2);
});

test("identical reanalysis does not create a spurious version or persistence write", async () => {
  const store = new MemoryStore();
  const service = new RequirementContractService(store);
  await service.publish({ commandKey: "cmd-p", contractId: "WC-3", content: plan(), correlationId: "corr-1", taskBlocks: [task("rq-a", "carry couch")], publishedAt: T1 });
  const result = await service.supersede({ commandKey: "cmd-noop", contractId: "WC-3", content: plan(), correlationId: "corr-2", reason: "planner rerun", taskBlocks: [task("rq-a", "carry couch")], publishedAt: T2 });
  assert.equal(result.changed, false);
  assert.equal(result.reference, "WC-3@1");
  assert.equal(store.supersedeCalls, 0);
});
