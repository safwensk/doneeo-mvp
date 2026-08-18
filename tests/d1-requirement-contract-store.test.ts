import test from "node:test";
import assert from "node:assert/strict";
import { D1RequirementContractStore, type D1DatabaseLike, type D1PreparedStatementLike } from "../lib/application/d1-requirement-contract-store";
import { draftContract, initializeLifecycle, publish } from "../lib/requirement-contract";
import { fingerprintTaskBlocks, sha256Stable } from "../lib/application/requirement-contract-hashing";
import type { JobIntelligence } from "../lib/planner";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(readonly sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
}
class RecordingDb implements D1DatabaseLike {
  prepared: Statement[] = [];
  batches: Statement[][] = [];
  prepare(sql: string) { const statement = new Statement(sql); this.prepared.push(statement); return statement; }
  async batch<T>(statements: D1PreparedStatementLike[]) { this.batches.push(statements as Statement[]); return [] as T[]; }
}

function plan(): JobIntelligence {
  return { version: "1", facts: [], primitives: [], resources: [], workstreams: [], fulfillment: { mode: "single_team", singleCustomerOrder: true, rationale: "one", groups: [] }, manpower: { minimum: 1, recommended: 1, reason: "one", alternatives: [] }, estimate: { ready: true, personMinutes: 10, executionMinutes: 10, accessMinutes: 0, routeMinutes: 0, bufferMinutes: 0, totalMinutes: 10, rangeLow: 10, rangeHigh: 10, equation: "10", assumptions: [] }, confidence: { level: "high", score: 90, reason: "ok" }, unresolved: [] } as JobIntelligence;
}

test("D1 publish sends command + contract + lifecycle + event + completion in one batch", async () => {
  const db = new RecordingDb();
  const store = new D1RequirementContractStore(db);
  const content = plan();
  const blocks = await fingerprintTaskBlocks([{ requirementId: "rq-a", scope: "scope", qualification: "helper", crew: 1, duration: 10, equipmentAndMaterials: [], accessAndLocations: [], temporalConstraints: [], dependencies: [], completionCriteria: ["done"], ruleDecisions: [] }]);
  const contract = publish(draftContract({ contractId: "WC-1", content, correlationId: "corr", taskBlocks: blocks }), { publishedAt: "2026-08-18T10:00:00.000Z", contentHash: await sha256Stable(content) });
  const lifecycle = initializeLifecycle(contract);
  await store.publishAtomic({
    contract, lifecycle,
    command: { commandKey: "cmd", commandType: "PublishRequirementContract", requestHash: "a".repeat(64), status: "SUCCEEDED", result: '{"reference":"WC-1@1"}', correlationId: "corr" },
    event: { streamId: "requirement-contract:WC-1", sequence: 1, eventType: "RequirementContractPublished", payload: "{}", correlationId: "corr", causationId: "cmd", occurredAt: "2026-08-18T10:00:00.000Z" },
  });
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 5);
  const joined = db.batches[0].map(s => s.sql).join("\n");
  assert.match(joined, /INSERT INTO command_log/);
  assert.match(joined, /INSERT INTO requirement_contracts/);
  assert.match(joined, /INSERT INTO task_block_identities/);
  assert.match(joined, /INSERT INTO domain_events/);
  assert.match(joined, /UPDATE command_log SET status = 'SUCCEEDED'/);
});
