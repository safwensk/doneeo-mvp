import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  beginArchitecting,
  createWorkCase,
  markRequirementReady,
  type WorkCaseControlState,
} from "../lib/work-case";
import type { TaskIdentity } from "../lib/intelligence-task-identity";
import { WorkCaseService } from "../lib/application/work-case-service";
import type {
  StoredCommand,
  RequirementContractStore,
  AtomicPublishWrite,
  AtomicSupersedeWrite,
} from "../lib/application/requirement-contract-store";
import type {
  WorkCaseEvent,
  WorkCaseStore,
} from "../lib/application/work-case-store";
import {
  RequirementContractService,
} from "../lib/application/requirement-contract-service";
import type {
  RequirementContract,
  TaskBlockLifecycleIdentity,
} from "../lib/requirement-contract";
import type { JobIntelligence } from "../lib/planner";

const T1 = "2026-08-18T10:00:00.000Z";
const T2 = "2026-08-18T10:01:00.000Z";
const T3 = "2026-08-18T10:02:00.000Z";
const T4 = "2026-08-18T10:03:00.000Z";

class WorkCaseMemoryStore implements WorkCaseStore {
  cases = new Map<string, WorkCaseControlState>();
  requests = new Map<string, string>();
  answers = new Map<string, Record<string, string | boolean>>();
  analyses = new Map<string, unknown>();
  tasks = new Map<string, TaskIdentity[]>();
  commands = new Map<string, StoredCommand>();

  async get(id: string) { return this.cases.get(id) ?? null; }
  async getRawRequest(id: string) { return this.requests.get(id) ?? null; }
  async getConfirmedAnswers(id: string) { return { ...(this.answers.get(id) || {}) }; }
  async getLatestAnalysis(id: string) { return this.analyses.get(id) ?? null; }
  async getTasks(id: string) { return (this.tasks.get(id) || []).map(x => ({ ...x })); }
  async getCommand(key: string) { return this.commands.get(key) ?? null; }

  async receiveAtomic(input: {
    workCase: WorkCaseControlState;
    rawRequest: string;
    command: StoredCommand;
    event: WorkCaseEvent;
  }) {
    this.cases.set(input.workCase.workCaseId, input.workCase);
    this.requests.set(input.workCase.workCaseId, input.rawRequest);
    this.answers.set(input.workCase.workCaseId, {});
    this.commands.set(input.command.commandKey, input.command);
  }

  async saveArchitectureAtomic(input: {
    previous: WorkCaseControlState;
    next: WorkCaseControlState;
    tasks: readonly TaskIdentity[];
    confirmedAnswers?: Readonly<Record<string, string | boolean>>;
    latestAnalysis?: unknown;
    command: StoredCommand;
    event: WorkCaseEvent;
  }) {
    this.cases.set(input.next.workCaseId, input.next);
    this.tasks.set(input.next.workCaseId, input.tasks.map(x => ({ ...x })));
    if (input.confirmedAnswers) {
      this.answers.set(input.next.workCaseId, { ...input.confirmedAnswers });
    }
    if (input.latestAnalysis !== undefined) {
      this.analyses.set(input.next.workCaseId, input.latestAnalysis);
    }
    this.commands.set(input.command.commandKey, input.command);
  }

  async markRequirementReadyAtomic(input: {
    previous: WorkCaseControlState;
    next: WorkCaseControlState;
    command: StoredCommand;
    event: WorkCaseEvent;
  }) {
    this.cases.set(input.next.workCaseId, input.next);
    this.commands.set(input.command.commandKey, input.command);
  }
}

class RequirementMemoryStore implements RequirementContractStore {
  contracts = new Map<string, RequirementContract>();
  lifecycle = new Map<string, TaskBlockLifecycleIdentity[]>();
  commands = new Map<string, StoredCommand>();

  key(id: string, version: number) { return `${id}@${version}`; }
  async getCurrent(id: string) {
    return [...this.contracts.values()].find(
      contract => contract.contractId === id && contract.status === "PUBLISHED",
    ) ?? null;
  }
  async getVersion(id: string, version: number) {
    return this.contracts.get(this.key(id, version)) ?? null;
  }
  async getLifecycle(id: string, version: number) {
    return (this.lifecycle.get(this.key(id, version)) || []).map(x => ({ ...x }));
  }
  async getCommand(key: string) { return this.commands.get(key) ?? null; }
  async publishAtomic(write: AtomicPublishWrite) {
    this.contracts.set(
      this.key(write.contract.contractId, write.contract.version),
      write.contract,
    );
    this.lifecycle.set(
      this.key(write.contract.contractId, write.contract.version),
      write.lifecycle.map(x => ({ ...x })),
    );
    this.commands.set(write.command.commandKey, write.command);
  }
  async supersedeAtomic(write: AtomicSupersedeWrite) {
    this.contracts.set(
      this.key(write.previous.contractId, write.previous.version),
      write.previous,
    );
    this.contracts.set(
      this.key(write.next.contractId, write.next.version),
      write.next,
    );
    this.lifecycle.set(
      this.key(write.next.contractId, write.next.version),
      write.lifecycle.map(x => ({ ...x })),
    );
    this.commands.set(write.command.commandKey, write.command);
  }
}

function ids() {
  let w = 0, j = 0, t = 0;
  return {
    newWorkCaseId: () => `WC-${++w}`,
    newJobOrderId: () => `JO-${++j}`,
    newTaskId: () => `T-${++t}`,
  };
}

function intelligence(): JobIntelligence {
  return {
    version: "test",
    facts: [],
    primitives: [],
    resources: [],
    workstreams: [{
      id: "task-1",
      sequence: 1,
      title: "Carry couch",
      domain: "transport_handling",
      qualification: "general_helper",
      phaseIds: [],
      resourceIds: [],
      minimumCrew: 2,
      recommendedCrew: 2,
      likelyMinutes: 30,
      rangeLow: 20,
      rangeHigh: 45,
      completionGate: "placed safely",
      serviceGroup: "shared",
      assignedRole: "handling crew",
      handoffRequired: false,
    }],
    fulfillment: {
      mode: "single_team",
      singleCustomerOrder: true,
      rationale: "one team",
      groups: [],
    },
    manpower: {
      minimum: 2,
      recommended: 2,
      reason: "safe lift",
      alternatives: [],
    },
    estimate: {
      ready: true,
      personMinutes: 60,
      executionMinutes: 30,
      accessMinutes: 0,
      routeMinutes: 0,
      bufferMinutes: 10,
      totalMinutes: 40,
      rangeLow: 30,
      rangeHigh: 50,
      equation: "30+10",
      assumptions: [],
    },
    confidence: { level: "high", score: 90, reason: "test" },
    unresolved: [],
  } as JobIntelligence;
}

test("reanalysis from REQUIREMENT_READY invalidates the stale current pointer", () => {
  const received = createWorkCase({
    workCaseId: "WC-1",
    jobOrderId: "JO-1",
    now: T1,
  });
  const architecting = beginArchitecting(received, {
    expectedVersion: 1,
    now: T2,
  });
  const ready = markRequirementReady(architecting, {
    expectedVersion: 2,
    requirementContractRef: "JO-1@1",
    now: T3,
  });
  const replanning = beginArchitecting(ready, {
    expectedVersion: 3,
    now: T4,
  });

  assert.equal(replanning.state, "ARCHITECTING");
  assert.equal(replanning.stateVersion, 4);
  assert.equal(replanning.current.requirementContractRef, null);
});

test("confirmed clarification facts are durable and are part of command idempotency", async () => {
  const store = new WorkCaseMemoryStore();
  const service = new WorkCaseService(store, ids());
  const received = await service.receiveRequest({
    commandKey: "receive",
    rawRequest: "Carry my couch upstairs to the third floor",
    correlationId: "corr",
    now: T1,
  });

  const common = {
    commandKey: "plan",
    workCaseId: received.workCase.workCaseId,
    expectedVersion: 1,
    taskCandidates: [{
      title: "Carry couch",
      domain: "transport_handling",
      ordinal: 1,
    }],
    correlationId: "corr",
    now: T2,
  };

  const analysisSnapshot = { title: "Carry couch", questions: [] };

  await service.recordArchitecture({
    ...common,
    confirmedAnswers: { elevator: false },
    latestAnalysis: analysisSnapshot,
  });

  assert.deepEqual(
    await store.getConfirmedAnswers("WC-1"),
    { elevator: false },
  );
  assert.deepEqual(
    await store.getLatestAnalysis("WC-1"),
    analysisSnapshot,
  );

  await assert.rejects(
    service.recordArchitecture({
      ...common,
      confirmedAnswers: { elevator: true },
    }),
    /idempotency key plan reused with different WorkCase input/,
  );
});

test("Requirement Contract retry ignores a later retry clock and replays the first result", async () => {
  const store = new RequirementMemoryStore();
  const service = new RequirementContractService(store);
  const content = intelligence();
  const taskBlocks = [{
    requirementId: "T-1",
    scope: "Carry couch",
    qualification: "general_helper",
    crew: 2,
    duration: 30,
    equipmentAndMaterials: [],
    accessAndLocations: [],
    temporalConstraints: [],
    dependencies: [],
    completionCriteria: ["placed safely"],
    ruleDecisions: [],
  }];

  const first = await service.publish({
    commandKey: "publish-1",
    contractId: "JO-1",
    content,
    correlationId: "corr",
    taskBlocks,
    publishedAt: T2,
  });

  const retry = await service.publish({
    commandKey: "publish-1",
    contractId: "JO-1",
    content,
    correlationId: "corr",
    taskBlocks,
    publishedAt: T4,
  });

  assert.equal(retry.replayed, true);
  assert.equal(retry.reference, first.reference);
  assert.equal(retry.contract.publishedAt, T2);
});

test("route and customer UI use server facts, retry/resume control, and no client planner fallback", () => {
  const route = fs.readFileSync("app/api/plan/route.ts", "utf8");
  const page = fs.readFileSync("app/page.tsx", "utf8");

  assert.match(route, /getConfirmedAnswers\(requestedWorkCaseId\)/);
  assert.match(route, /priorArchitecture/);
  assert.match(route, /body\.resume === true/);
  assert.match(route, /mode: "read-only-resume"/);
  assert.match(route, /getLatestAnalysis\(requestedWorkCaseId\)/);
  assert.match(route, /return Response\.json\(\{[\s\S]*mode: "read-only-resume"/);
  assert.match(route, /expectedWorkCaseVersion: expectedAnalysisVersion/);
  assert.match(route, /confirmedAnswers: customerAnswers/);
  assert.match(route, /new D1IntelligenceControlService/);

  assert.match(page, /doneeo\.activeWorkCase/);
  assert.match(page, /resume: true/);
  assert.match(page, /intakeAttemptRef/);
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(
    page,
    /buildJobIntelligence\(applyDoneeoRulesGate\(enforceSafety/,
  );
});
