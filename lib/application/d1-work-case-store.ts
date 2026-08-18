import type { TaskIdentity } from "../intelligence-task-identity";
import type { WorkCaseControlState } from "../work-case";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-requirement-contract-store";
import type { StoredCommand } from "./requirement-contract-store";
import type { WorkCaseEvent, WorkCaseStore } from "./work-case-store";

type WorkCaseRow = {
  work_case_id: string;
  job_order_id: string;
  state: WorkCaseControlState["state"];
  state_version: number;
  current_requirement_ref: string | null;
  current_fulfillment_ref: string | null;
  current_execution_ref: string | null;
  current_outcome_ref: string | null;
  created_at: string;
  updated_at: string;
};
type TaskRow = {
  work_case_id: string;
  task_id: string;
  semantic_key: string;
  ordinal: number;
  title: string;
  domain: string;
  status: "ACTIVE" | "RETIRED";
};
type CommandRow = {
  command_key: string;
  command_type: string;
  request_hash: string;
  status: "IN_FLIGHT" | "SUCCEEDED" | "FAILED";
  result: string | null;
  correlation_id: string;
};

export class D1WorkCaseStore implements WorkCaseStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async get(workCaseId: string): Promise<WorkCaseControlState | null> {
    const row = await this.db.prepare(
      `SELECT work_case_id, job_order_id, state, state_version, current_requirement_ref, current_fulfillment_ref,
              current_execution_ref, current_outcome_ref, created_at, updated_at
       FROM work_cases WHERE work_case_id = ?`,
    ).bind(workCaseId).first<WorkCaseRow>();
    return row ? hydrate(row) : null;
  }

  async getRawRequest(workCaseId: string): Promise<string | null> {
    const row = await this.db.prepare(`SELECT raw_request FROM intelligence_requests WHERE work_case_id = ?`).bind(workCaseId).first<{ raw_request: string }>();
    return row?.raw_request ?? null;
  }

  async getConfirmedAnswers(workCaseId: string): Promise<Record<string, string | boolean>> {
    const row = await this.db.prepare(
      `SELECT confirmed_answers_json FROM intelligence_requests WHERE work_case_id = ?`,
    ).bind(workCaseId).first<{ confirmed_answers_json: string }>();

    if (!row?.confirmed_answers_json) return {};

    try {
      const parsed = JSON.parse(row.confirmed_answers_json) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([key, value]) =>
            /^[a-z0-9_]{1,64}$/i.test(key) &&
            (typeof value === "boolean" ||
              (typeof value === "string" && value.length <= 300)),
        ),
      ) as Record<string, string | boolean>;
    } catch {
      throw new Error(`Stored clarification facts are invalid for WorkCase ${workCaseId}`);
    }
  }

  async getLatestAnalysis(workCaseId: string): Promise<unknown | null> {
    const row = await this.db.prepare(
      `SELECT latest_analysis_json FROM intelligence_requests WHERE work_case_id = ?`,
    ).bind(workCaseId).first<{ latest_analysis_json: string | null }>();

    if (!row?.latest_analysis_json) return null;

    try {
      return JSON.parse(row.latest_analysis_json) as unknown;
    } catch {
      throw new Error(`Stored analysis snapshot is invalid for WorkCase ${workCaseId}`);
    }
  }

  async getTasks(workCaseId: string): Promise<TaskIdentity[]> {
    const { results } = await this.db.prepare(
      `SELECT work_case_id, task_id, semantic_key, ordinal, title, domain, status
       FROM intelligence_task_identities WHERE work_case_id = ? ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END, ordinal`,
    ).bind(workCaseId).all<TaskRow>();
    return results.map(row => ({ taskId: row.task_id, semanticKey: row.semantic_key, ordinal: row.ordinal, title: row.title, domain: row.domain, status: row.status }));
  }

  async getCommand(commandKey: string): Promise<StoredCommand | null> {
    const row = await this.db.prepare(`SELECT command_key, command_type, request_hash, status, result, correlation_id FROM command_log WHERE command_key = ?`).bind(commandKey).first<CommandRow>();
    if (!row || row.status === "IN_FLIGHT") return null;
    return { commandKey: row.command_key, commandType: row.command_type, requestHash: row.request_hash, status: row.status, result: row.result, correlationId: row.correlation_id };
  }

  async receiveAtomic(input: { workCase: WorkCaseControlState; rawRequest: string; command: StoredCommand; event: WorkCaseEvent }): Promise<void> {
    const now = input.workCase.createdAt;
    await this.db.batch([
      this.insertCommand(input.command, now),
      this.db.prepare(
        `INSERT INTO work_cases
         (work_case_id, job_order_id, state, state_version, current_requirement_ref, current_fulfillment_ref,
          current_execution_ref, current_outcome_ref, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
      ).bind(input.workCase.workCaseId, input.workCase.jobOrderId, input.workCase.state, input.workCase.stateVersion, now, now),
      this.db.prepare(`INSERT INTO intelligence_requests (work_case_id, raw_request, confirmed_answers_json, latest_analysis_json, created_at) VALUES (?, ?, '{}', NULL, ?)`).bind(input.workCase.workCaseId, input.rawRequest, now),
      this.insertEvent(input.event),
      this.finishCommand(input.command, now),
    ]);
  }

  async saveArchitectureAtomic(input: { previous: WorkCaseControlState; next: WorkCaseControlState; tasks: readonly TaskIdentity[]; confirmedAnswers?: Readonly<Record<string, string | boolean>>; latestAnalysis?: unknown; command: StoredCommand; event: WorkCaseEvent }): Promise<void> {
    const statements: D1PreparedStatementLike[] = [
      this.insertCommand(input.command, input.next.updatedAt),
      this.updateControl(input.previous, input.next),
      ...(input.confirmedAnswers || input.latestAnalysis !== undefined
        ? [
            this.db.prepare(
              `UPDATE intelligence_requests
               SET confirmed_answers_json = COALESCE(?, confirmed_answers_json),
                   latest_analysis_json = COALESCE(?, latest_analysis_json)
               WHERE work_case_id = ?`,
            ).bind(
              input.confirmedAnswers ? JSON.stringify(input.confirmedAnswers) : null,
              input.latestAnalysis !== undefined ? JSON.stringify(input.latestAnalysis) : null,
              input.next.workCaseId,
            ),
          ]
        : []),
      this.db.prepare(`DELETE FROM intelligence_task_identities WHERE work_case_id = ?`).bind(input.next.workCaseId),
      ...input.tasks.map(task => this.db.prepare(
        `INSERT INTO intelligence_task_identities
         (work_case_id, task_id, semantic_key, ordinal, title, domain, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(input.next.workCaseId, task.taskId, task.semanticKey, task.ordinal, task.title, task.domain, task.status, input.previous.createdAt, input.next.updatedAt)),
      this.insertEvent(input.event),
      this.finishCommand(input.command, input.next.updatedAt),
    ];
    await this.db.batch(statements);
  }

  async markRequirementReadyAtomic(input: { previous: WorkCaseControlState; next: WorkCaseControlState; command: StoredCommand; event: WorkCaseEvent }): Promise<void> {
    await this.db.batch([
      this.insertCommand(input.command, input.next.updatedAt),
      this.updateControl(input.previous, input.next),
      this.insertEvent(input.event),
      this.finishCommand(input.command, input.next.updatedAt),
    ]);
  }

  private updateControl(previous: WorkCaseControlState, next: WorkCaseControlState): D1PreparedStatementLike {
    return this.db.prepare(
      `UPDATE work_cases SET state = ?, state_version = ?, current_requirement_ref = ?, current_fulfillment_ref = ?,
       current_execution_ref = ?, current_outcome_ref = ?, updated_at = ?
       WHERE work_case_id = ? AND state_version = ?`,
    ).bind(next.state, next.stateVersion, next.current.requirementContractRef, next.current.fulfillmentPlanRef, next.current.executionSnapshotRef, next.current.outcomeRef, next.updatedAt, next.workCaseId, previous.stateVersion);
  }

  private insertCommand(command: StoredCommand, now: string) {
    return this.db.prepare(
      `INSERT INTO command_log (command_key, command_type, request_hash, status, result, correlation_id, created_at, completed_at)
       VALUES (?, ?, ?, 'IN_FLIGHT', NULL, ?, ?, NULL)`,
    ).bind(command.commandKey, command.commandType, command.requestHash, command.correlationId, now);
  }
  private finishCommand(command: StoredCommand, now: string) {
    return this.db.prepare(`UPDATE command_log SET status = 'SUCCEEDED', result = ?, completed_at = ? WHERE command_key = ? AND request_hash = ? AND status = 'IN_FLIGHT'`)
      .bind(command.result, now, command.commandKey, command.requestHash);
  }
  private insertEvent(event: WorkCaseEvent) {
    return this.db.prepare(`INSERT INTO domain_events (stream_id, sequence, event_type, payload, correlation_id, causation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.streamId, event.sequence, event.eventType, event.payload, event.correlationId, event.causationId, event.occurredAt);
  }
}

function hydrate(row: WorkCaseRow): WorkCaseControlState {
  return Object.freeze({
    workCaseId: row.work_case_id,
    jobOrderId: row.job_order_id,
    stateVersion: row.state_version,
    state: row.state,
    current: Object.freeze({
      requirementContractRef: row.current_requirement_ref,
      fulfillmentPlanRef: row.current_fulfillment_ref,
      executionSnapshotRef: row.current_execution_ref,
      outcomeRef: row.current_outcome_ref,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
