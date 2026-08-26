/**
 * D1 persistence for L09A and L09B.
 *
 * Observations, changed facts and classifications are INSERT-only here. There
 * is no UPDATE statement against those three tables anywhere in this file, and
 * that is the point: superseded_value has to still say what was believed at
 * planning time when someone disputes the job six weeks later.
 */

import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-requirement-contract-store";
import type { StoredCommand } from "./requirement-contract-store";
import type { RealityStore, StoredRealityCase, RealityEvent } from "./reality-store";
import type {
  FieldObservation, ChangedFact, ImpactClassification, ImpactClass,
} from "../layers/l09a/reality";
import type { RecoveryDecision } from "../layers/l09a/recovery";
import type { ResponsibilityAssessment, Cause } from "../layers/l09b/responsibility";
import type { AdjustmentInstruction } from "../layers/l09b/allocation";

type CaseRow = {
  reality_case_id: string; work_case_id: string; job_order_id: string;
  opened_at: string; status: StoredRealityCase["realityCase"]["status"];
  held_task_ids_json: string; state_version: number;
};
type ObservationRow = {
  observation_id: string; task_id: string; observed_at: string;
  observed_by: string; statement: string; evidence_refs_json: string;
};
type FactRow = {
  fact_key: string; superseded_value: string | null; new_value: string;
  source: ChangedFact["source"]; evidence_refs_json: string; changed_at: string;
};
type ClassificationRow = {
  task_id: string; impact: ImpactClass; rationale: string; needs_human_review: number;
};
type CommandRow = {
  command_key: string; command_type: string; request_hash: string;
  status: "IN_FLIGHT" | "SUCCEEDED" | "FAILED"; result: string | null; correlation_id: string;
};
type AssessmentRow = {
  assessment_id: string; reality_case_id: string | null; cause: Cause;
  customer_established: number; provider_established: number; doneeo_established: number;
  reasoning_json: string; requires_review: number; review_reason: string | null;
  evidence_refs_json: string;
};
type InstructionRow = {
  instruction_id: string; job_order_id: string;
  protected_provider_minutes: number; customer_adjustment_minutes: number;
  doneeo_absorption_minutes: number; recovery_credit_minutes: number;
  by_role_json: string; allocations_json: string; external_cost_refs_json: string;
};

export class D1RealityStore implements RealityStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async get(realityCaseId: string): Promise<StoredRealityCase | null> {
    const row = await this.db.prepare(
      `SELECT reality_case_id, work_case_id, job_order_id, opened_at, status, held_task_ids_json, state_version
       FROM reality_cases WHERE reality_case_id = ?`,
    ).bind(realityCaseId).first<CaseRow>();
    return row ? this.hydrate(row) : null;
  }

  async findOpenByJobOrder(jobOrderId: string): Promise<StoredRealityCase | null> {
    const row = await this.db.prepare(
      `SELECT reality_case_id, work_case_id, job_order_id, opened_at, status, held_task_ids_json, state_version
       FROM reality_cases WHERE job_order_id = ? AND status IN ('OPEN','RECOVERING')
       ORDER BY opened_at DESC LIMIT 1`,
    ).bind(jobOrderId).first<CaseRow>();
    return row ? this.hydrate(row) : null;
  }

  private async hydrate(row: CaseRow): Promise<StoredRealityCase> {
    const id = row.reality_case_id;
    const [obs, facts, cls] = await Promise.all([
      this.db.prepare(
        `SELECT observation_id, task_id, observed_at, observed_by, statement, evidence_refs_json
         FROM field_observations WHERE reality_case_id = ? ORDER BY observed_at, observation_id`,
      ).bind(id).all<ObservationRow>(),
      this.db.prepare(
        `SELECT fact_key, superseded_value, new_value, source, evidence_refs_json, changed_at
         FROM changed_facts WHERE reality_case_id = ? ORDER BY id`,
      ).bind(id).all<FactRow>(),
      this.db.prepare(
        `SELECT task_id, impact, rationale, needs_human_review
         FROM impact_classifications WHERE reality_case_id = ? ORDER BY id`,
      ).bind(id).all<ClassificationRow>(),
    ]);

    const observations: FieldObservation[] = (obs.results ?? []).map(o => Object.freeze({
      observationId: o.observation_id, taskId: o.task_id, observedAt: o.observed_at,
      observedBy: o.observed_by, statement: o.statement,
      evidenceRefs: Object.freeze(safeArray(o.evidence_refs_json)),
    }));
    const changedFacts: ChangedFact[] = (facts.results ?? []).map(f => Object.freeze({
      factKey: f.fact_key, supersededValue: f.superseded_value, newValue: f.new_value,
      source: f.source, evidenceRefs: Object.freeze(safeArray(f.evidence_refs_json)),
      changedAt: f.changed_at,
    }));
    const classifications: ImpactClassification[] = (cls.results ?? []).map(c => Object.freeze({
      taskId: c.task_id, impact: c.impact, rationale: c.rationale,
      needsHumanReview: c.needs_human_review === 1,
    }));

    return Object.freeze({
      realityCase: Object.freeze({
        realityCaseId: row.reality_case_id,
        workCaseId: row.work_case_id,
        jobOrderId: row.job_order_id,
        openedAt: row.opened_at,
        observations: Object.freeze(observations),
        changedFacts: Object.freeze(changedFacts),
        fieldMSI: Object.freeze([]),
        classifications: Object.freeze(classifications),
        heldTaskIds: Object.freeze(safeArray(row.held_task_ids_json)),
        status: row.status,
      }),
      stateVersion: row.state_version,
    });
  }

  async getCommand(commandKey: string): Promise<StoredCommand | null> {
    const row = await this.db.prepare(
      `SELECT command_key, command_type, request_hash, status, result, correlation_id
       FROM command_log WHERE command_key = ?`,
    ).bind(commandKey).first<CommandRow>();
    if (!row || row.status === "IN_FLIGHT") return null;
    return {
      commandKey: row.command_key, commandType: row.command_type, requestHash: row.request_hash,
      status: row.status, result: row.result, correlationId: row.correlation_id,
    };
  }

  async openAtomic(input: { stored: StoredRealityCase; command: StoredCommand; event: RealityEvent }) {
    const rc = input.stored.realityCase;
    await this.db.batch([
      this.insertCommand(input.command, rc.openedAt),
      this.db.prepare(
        `INSERT INTO reality_cases
         (reality_case_id, work_case_id, job_order_id, opened_at, status, held_task_ids_json, state_version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(rc.realityCaseId, rc.workCaseId, rc.jobOrderId, rc.openedAt, rc.status,
        JSON.stringify(rc.heldTaskIds), input.stored.stateVersion, rc.openedAt),
      this.insertEvent(input.event),
      this.finishCommand(input.command, rc.openedAt),
    ]);
  }

  async appendObservationAtomic(input: Parameters<RealityStore["appendObservationAtomic"]>[0]) {
    const rc = input.next.realityCase;
    const now = input.event.occurredAt;
    await this.db.batch([
      this.insertCommand(input.command, now),
      this.db.prepare(
        `UPDATE reality_cases SET held_task_ids_json = ?, status = ?, state_version = ?, updated_at = ?
         WHERE reality_case_id = ? AND state_version = ?`,
      ).bind(JSON.stringify(rc.heldTaskIds), rc.status, input.next.stateVersion, now,
        rc.realityCaseId, input.previous.stateVersion),
      this.db.prepare(
        `INSERT INTO field_observations
         (observation_id, reality_case_id, task_id, observed_at, observed_by, statement, evidence_refs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(input.observation.observationId, rc.realityCaseId, input.observation.taskId,
        input.observation.observedAt, input.observation.observedBy, input.observation.statement,
        JSON.stringify(input.observation.evidenceRefs)),
      ...input.changedFacts.map(f => this.db.prepare(
        `INSERT INTO changed_facts
         (reality_case_id, fact_key, superseded_value, new_value, source, evidence_refs_json, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(rc.realityCaseId, f.factKey, f.supersededValue, f.newValue, f.source,
        JSON.stringify(f.evidenceRefs), f.changedAt)),
      this.db.prepare(
        `INSERT INTO impact_classifications
         (reality_case_id, task_id, impact, rationale, needs_human_review, classifier_name, classified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(rc.realityCaseId, input.classification.taskId, input.classification.impact,
        input.classification.rationale, input.classification.needsHumanReview ? 1 : 0,
        input.classifierName, now),
      this.insertEvent(input.event),
      this.finishCommand(input.command, now),
    ]);
  }

  async saveRecoveryAtomic(input: Parameters<RealityStore["saveRecoveryAtomic"]>[0]) {
    const rc = input.next.realityCase;
    const now = input.event.occurredAt;
    const d: RecoveryDecision = input.decision;
    await this.db.batch([
      this.insertCommand(input.command, now),
      this.db.prepare(
        `UPDATE reality_cases SET status = ?, state_version = ?, updated_at = ?
         WHERE reality_case_id = ? AND state_version = ?`,
      ).bind(rc.status, input.next.stateVersion, now, rc.realityCaseId, input.previous.stateVersion),
      this.db.prepare(
        `INSERT INTO recovery_decisions
         (reality_case_id, selected_kind, considered_json, route_to_json, continuing_task_ids_json,
          unrecoverable, needs_customer_approval, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(rc.realityCaseId, d.selected?.kind ?? null, JSON.stringify(d.considered),
        JSON.stringify(d.routeTo), JSON.stringify(d.continuingTaskIds),
        d.unrecoverable ? 1 : 0, d.needsCustomerApproval ? 1 : 0, now),
      this.insertEvent(input.event),
      this.finishCommand(input.command, now),
    ]);
  }

  async saveSettlementAtomic(input: Parameters<RealityStore["saveSettlementAtomic"]>[0]) {
    const a = input.assessment;
    const now = input.now;
    const statements: D1PreparedStatementLike[] = [
      this.insertCommand(input.command, now),
      this.db.prepare(
        `INSERT INTO responsibility_assessments
         (assessment_id, reality_case_id, job_order_id, cause, customer_established, provider_established,
          doneeo_established, reasoning_json, requires_review, review_reason, evidence_refs_json,
          policy_name, assessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        input.assessmentId, input.realityCaseId, input.jobOrderId, a.cause,
        a.customer.established ? 1 : 0, a.provider.established ? 1 : 0, a.doneeo.established ? 1 : 0,
        JSON.stringify({ customer: a.customer.because, provider: a.provider.because, doneeo: a.doneeo.because }),
        a.requiresReview ? 1 : 0, a.reviewReason, JSON.stringify(a.evidenceRefs),
        input.policyName, now,
      ),
    ];

    // A reviewed case stores no instruction. Nothing here invents one.
    if (input.instruction && input.instructionId) {
      const i = input.instruction;
      statements.push(this.db.prepare(
        `INSERT INTO adjustment_instructions
         (instruction_id, assessment_id, job_order_id, protected_provider_minutes,
          customer_adjustment_minutes, doneeo_absorption_minutes, recovery_credit_minutes,
          by_role_json, allocations_json, external_cost_refs_json, issued_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        input.instructionId, input.assessmentId, input.jobOrderId,
        i.protectedProviderPayable.minutes, i.customerRealityAdjustment.minutes,
        i.doneeoAbsorption.minutes, i.recoveryCredit.minutes,
        JSON.stringify({
          protectedProvider: i.protectedProviderPayable.byRole,
          customer: i.customerRealityAdjustment.byRole,
          doneeoAbsorption: i.doneeoAbsorption.byRole,
        }),
        JSON.stringify(i.allocations), JSON.stringify(i.customerRealityAdjustment.externalCostRefs), now,
      ));
    }

    statements.push(this.insertEvent(input.event), this.finishCommand(input.command, now));
    await this.db.batch(statements);
  }

  async getAssessment(assessmentId: string) {
    const row = await this.db.prepare(
      `SELECT assessment_id, reality_case_id, cause, customer_established, provider_established,
              doneeo_established, reasoning_json, requires_review, review_reason, evidence_refs_json
       FROM responsibility_assessments WHERE assessment_id = ?`,
    ).bind(assessmentId).first<AssessmentRow>();
    if (!row) return null;

    const reasoning = safeObject(row.reasoning_json);
    const assessment: ResponsibilityAssessment = Object.freeze({
      realityCaseId: row.reality_case_id ?? "",
      cause: row.cause,
      customer: { established: row.customer_established === 1, because: reasoning.customer ?? "" },
      provider: { established: row.provider_established === 1, because: reasoning.provider ?? "" },
      doneeo: { established: row.doneeo_established === 1, because: reasoning.doneeo ?? "" },
      requiresReview: row.requires_review === 1,
      reviewReason: row.review_reason,
      evidenceRefs: Object.freeze(safeArray(row.evidence_refs_json)),
    });

    const inst = await this.db.prepare(
      `SELECT instruction_id, job_order_id, protected_provider_minutes, customer_adjustment_minutes,
              doneeo_absorption_minutes, recovery_credit_minutes, by_role_json, allocations_json,
              external_cost_refs_json
       FROM adjustment_instructions WHERE assessment_id = ?`,
    ).bind(assessmentId).first<InstructionRow>();
    if (!inst) return { assessment, instruction: null };

    const byRole = safeObject(inst.by_role_json) as Record<string, Record<string, number>>;
    const total = (minutes: number, roles: Record<string, number> | undefined, refs: string[] = []) =>
      Object.freeze({ minutes, externalCostRefs: Object.freeze(refs), byRole: Object.freeze(roles ?? {}) });

    const instruction = Object.freeze({
      realityCaseId: assessment.realityCaseId,
      cause: assessment.cause,
      allocations: Object.freeze(safeArrayOf(inst.allocations_json)),
      protectedProviderPayable: total(inst.protected_provider_minutes, byRole.protectedProvider),
      customerRealityAdjustment: total(inst.customer_adjustment_minutes, byRole.customer, safeArray(inst.external_cost_refs_json)),
      doneeoAbsorption: total(inst.doneeo_absorption_minutes, byRole.doneeoAbsorption),
      recoveryCredit: total(inst.recovery_credit_minutes, {}),
      requiresReview: false,
      chargesUnperformedWork: false,
    }) as AdjustmentInstruction;

    return { assessment, instruction };
  }

  // -------------------------------------------------------------------------

  private insertCommand(c: StoredCommand, now: string): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO command_log (command_key, command_type, request_hash, status, result, correlation_id, created_at)
       VALUES (?, ?, ?, 'IN_FLIGHT', NULL, ?, ?)`,
    ).bind(c.commandKey, c.commandType, c.requestHash, c.correlationId, now);
  }

  private finishCommand(c: StoredCommand, now: string): D1PreparedStatementLike {
    return this.db.prepare(
      `UPDATE command_log SET status = ?, result = ?, completed_at = ? WHERE command_key = ?`,
    ).bind(c.status, c.result, now, c.commandKey);
  }

  private insertEvent(e: RealityEvent): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO work_order_events (work_order_id, event_type, title, detail, actor, created_at)
       SELECT id, ?, ?, ?, 'system', ? FROM work_orders WHERE job_order_id = ?`,
    ).bind(e.eventType, e.eventType, e.payload, e.occurredAt, e.jobOrderId);
  }
}

function safeArray(json: string): string[] {
  try {
    const p = JSON.parse(json);
    return Array.isArray(p) ? p.map(String) : [];
  } catch { return []; }
}
function safeArrayOf(json: string): unknown[] {
  try {
    const p = JSON.parse(json);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
function safeObject(json: string): Record<string, never> & Record<string, string> {
  try {
    const p = JSON.parse(json);
    return (p && typeof p === "object" ? p : {}) as Record<string, never> & Record<string, string>;
  } catch { return {} as Record<string, never> & Record<string, string>; }
}
