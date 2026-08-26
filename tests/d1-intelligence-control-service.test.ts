import test from "node:test";
import assert from "node:assert/strict";

import {
  D1IntelligenceControlService,
} from "../lib/application/d1-intelligence-control-service";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../lib/application/d1-requirement-contract-store";
import type {
  RequirementContractStore,
  StoredCommand,
  AtomicPublishWrite,
  AtomicSupersedeWrite,
} from "../lib/application/requirement-contract-store";
import type {
  WorkCaseStore,
} from "../lib/application/work-case-store";
import type {
  RequirementContract,
  TaskBlockLifecycleIdentity,
} from "../lib/requirement-contract";
import type {
  PlannerAnalysis,
  JobIntelligence,
} from "../lib/planner";
import type {
  WorkCaseControlState,
} from "../lib/work-case";
import type {
  TaskIdentity,
} from "../lib/intelligence-task-identity";
import type {
  WorkCaseService,
} from "../lib/application/work-case-service";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(readonly sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
}

class RecordingDb implements D1DatabaseLike {
  batches: Statement[][] = [];
  prepare(sql: string) { return new Statement(sql); }
  async batch<T>(statements: D1PreparedStatementLike[]) {
    this.batches.push(statements as Statement[]);
    return [] as T[];
  }
}

class EmptyRequirementStore implements RequirementContractStore {
  async getCurrent(_id: string) { return null; }
  async getVersion(_id: string, _version: number) { return null; }
  async getLifecycle(_id: string, _version: number) { return []; }
  async getCommand(_key: string) { return null; }
  async publishAtomic(_write: AtomicPublishWrite) { throw new Error("should use combined D1 batch"); }
  async supersedeAtomic(_write: AtomicSupersedeWrite) { throw new Error("should use combined D1 batch"); }
}

const architecting: WorkCaseControlState = {
  workCaseId: "WC-1",
  jobOrderId: "JO-1",
  stateVersion: 2,
  state: "ARCHITECTING",
  currentLayerId: "L02",
  current: {
    requirementContractRef: null,
    fulfillmentPlanRef: null,
    executionSnapshotRef: null,
    outcomeRef: null,
  },
  createdAt: "2026-08-18T10:00:00.000Z",
  updatedAt: "2026-08-18T10:01:00.000Z",
};

const task: TaskIdentity = {
  taskId: "T-1",
  semanticKey: "transport handling::carry couch",
  ordinal: 1,
  title: "Carry couch",
  domain: "transport_handling",
  status: "ACTIVE",
};

function analysis(): PlannerAnalysis {
  const intelligence: JobIntelligence = {
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

  return {
    category: "moving",
    title: "Move couch",
    summary: "Carry couch",
    safetyNote: "safe lift",
    questions: [],
    extractedAnswers: {},
    tasks: ["Carry couch"],
    stops: ["Home"],
    routeNodes: [{ location: "Home", actions: ["Carry couch"] }],
    scheduleWindow: { dateLabel: "Tomorrow", arrivalTime: "10:00 AM", arrivalLabel: "Tomorrow at 10:00 AM" },
    items: ["couch"],
    customerCanHelp: false, preparation: [],
    equipment: [],
    recurrence: { recurring: false, frequency: "One-time" },
    recommendedTeamSize: 2,
    skillRequirements: ["Safe lifting"],
    executionSteps: ["Carry couch"],
    understoodFacts: [],
    estimate: {
      serviceMinutesPerVisit: 30,
      travelMinutes: 0,
      people: 2,
      recurringVisits: "One-time",
      materialsSummary: "None",
    },
    sourceText: "Carry my couch upstairs",
    audit: { status: "deterministic", issues: [], checks: [] },
    rulesGate: {
      version: "1",
      status: "cleared",
      riskLevel: "standard",
      providerClass: "general_helper",
      summary: "test",
      issues: [],
      safeguards: [],
      domains: [],
    },
    intelligence,
  } as PlannerAnalysis;
}

test("new Requirement Contract and WorkCase REQUIREMENT_READY pointer are emitted in one D1 batch", async () => {
  const db = new RecordingDb();

  const workCases = {
    async recordArchitecture() {
      return { workCase: architecting, tasks: [task], replayed: false };
    },
    async requirementReady() {
      throw new Error("new contract path must use combined D1 batch");
    },
  } as unknown as Pick<WorkCaseService, "recordArchitecture" | "requirementReady">;

  const workCaseStore = {
    async get() { return architecting; },
    async getCommand() { return null; },
  } as unknown as Pick<WorkCaseStore, "get" | "getCommand">;

  const service = new D1IntelligenceControlService(
    db,
    workCases,
    workCaseStore,
    new EmptyRequirementStore(),
  );

  const result = await service.acceptAnalysis({
    workCaseId: "WC-1",
    expectedWorkCaseVersion: 1,
    analysis: analysis(),
    confirmedAnswers: { elevator: false },
    correlationId: "corr",
    commandKey: "plan-1",
    now: "2026-08-18T10:02:00.000Z",
  });

  assert.equal(result.state, "REQUIREMENT_READY");
  assert.equal(result.requirementContract?.reference, "JO-1@1");
  assert.equal(db.batches.length, 1);

  const statements = db.batches[0];
  const sql = statements.map(statement => statement.sql).join("\n");

  // The stale-version guard must execute before any Requirement Contract write.
  assert.match(statements[0].sql, /INSERT INTO command_log/);
  assert.match(statements[0].sql, /EXISTS \(/);
  assert.match(statements[0].sql, /work_case_id = \? AND state_version = \?/);
  assert.match(statements[0].sql, /THEN \?/);
  assert.match(statements[0].sql, /ELSE NULL/);

  const contractIndex = statements.findIndex(statement =>
    /INSERT INTO requirement_contracts/.test(statement.sql),
  );
  assert.ok(contractIndex > 0);

  assert.match(sql, /INSERT INTO requirement_contracts/);
  assert.match(sql, /INSERT INTO task_block_identities/);
  assert.match(sql, /UPDATE work_cases SET state/);
  assert.match(sql, /requirement_contracts|requirement-contract/);
  assert.match(sql, /INSERT INTO domain_events/);
  assert.match(sql, /INSERT INTO command_log/);
});
