/**
 * D1 persistence for L7.
 *
 * Note what is not written anywhere below: a stage column. Stage is derived on
 * read from the stored facts and the governing policy, because a stored stage
 * goes stale the moment the clock crosses a threshold.
 */

import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-requirement-contract-store";
import type { StoredCommand } from "./requirement-contract-store";
import type { CommitmentStore, StoredCommitment, CommitmentEvent } from "./commitment-store";
import type { CapacityReservation, PreparationRecord } from "../layers/l7/commitment";

type CommitmentRow = {
  job_order_id: string;
  work_case_id: string | null;
  policy_name: string;
  provider_accepted: number;
  mobilization_started_at: string | null;
  work_started_at: string | null;
  frozen_at: string | null;
  state_version: number;
  updated_at: string;
};
type ReservationRow = {
  reservation_id: string;
  role: string;
  assignee_ref: string;
  minutes_reserved: number;
  minutes_reallocated: number;
  starts_at: string;
  status: CapacityReservation["status"];
};
type PreparationRow = {
  reservation_id: string;
  preparation_minutes: number;
  mobilization_minutes: number;
  external_cost_refs_json: string;
};
type CommandRow = {
  command_key: string; command_type: string; request_hash: string;
  status: "IN_FLIGHT" | "SUCCEEDED" | "FAILED"; result: string | null; correlation_id: string;
};

export class D1CommitmentStore implements CommitmentStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async get(jobOrderId: string): Promise<StoredCommitment | null> {
    const row = await this.db.prepare(
      `SELECT job_order_id, work_case_id, policy_name, provider_accepted, mobilization_started_at,
              work_started_at, frozen_at, state_version, updated_at
       FROM commitments WHERE job_order_id = ?`,
    ).bind(jobOrderId).first<CommitmentRow>();
    if (!row) return null;

    const reservations = await this.reservations(jobOrderId);
    const preps = await this.db.prepare(
      `SELECT p.reservation_id, p.preparation_minutes, p.mobilization_minutes, p.external_cost_refs_json
       FROM preparation_records p
       JOIN capacity_reservations r ON r.reservation_id = p.reservation_id
       WHERE r.job_order_id = ?`,
    ).bind(jobOrderId).all<PreparationRow>();

    const preparation: PreparationRecord[] = (preps.results ?? []).map(p => Object.freeze({
      reservationId: p.reservation_id,
      preparationMinutes: p.preparation_minutes,
      mobilizationMinutes: p.mobilization_minutes,
      externalCostRefs: Object.freeze(safeArray(p.external_cost_refs_json)),
    }));

    return Object.freeze({
      state: Object.freeze({
        jobOrderId: row.job_order_id,
        // Persisted for readability only; every decision path recomputes it.
        stage: "FREE_OR_LOW" as const,
        reservations: Object.freeze(reservations),
        preparation: Object.freeze(preparation),
        workStartedAt: row.work_started_at,
        frozen: row.frozen_at !== null,
        updatedAt: row.updated_at,
      }),
      workCaseId: row.work_case_id,
      policyName: row.policy_name,
      providerAccepted: row.provider_accepted === 1,
      mobilizationStartedAt: row.mobilization_started_at,
      workStartedAt: row.work_started_at,
      stateVersion: row.state_version,
    });
  }

  async reservations(jobOrderId: string): Promise<readonly CapacityReservation[]> {
    const rows = await this.db.prepare(
      `SELECT reservation_id, role, assignee_ref, minutes_reserved, minutes_reallocated, starts_at, status
       FROM capacity_reservations WHERE job_order_id = ? ORDER BY reservation_id`,
    ).bind(jobOrderId).all<ReservationRow>();
    return (rows.results ?? []).map(r => Object.freeze({
      reservationId: r.reservation_id,
      role: r.role,
      assigneeRef: r.assignee_ref,
      minutesReserved: r.minutes_reserved,
      minutesReallocated: r.minutes_reallocated,
      startsAt: r.starts_at,
      status: r.status,
    }));
  }

  /**
   * Accepted assignments only.
   *
   * The status filter is the point: capacity is held against people who said
   * yes, never against an offer that is still outstanding.
   */
  async acceptedAssignments(jobOrderId: string) {
    const rows = await this.db.prepare(
      `SELECT a.executor_id, a.role, a.is_lead
       FROM assignments a
       JOIN work_orders w ON w.id = a.work_order_id
       WHERE w.job_order_id = ? AND a.status = 'accepted'
       ORDER BY a.is_lead DESC, a.executor_id`,
    ).bind(jobOrderId).all<{ executor_id: string; role: string; is_lead: number }>();
    return (rows.results ?? []).map(r => ({
      executorId: r.executor_id, role: r.role, isLead: r.is_lead === 1,
    }));
  }

  async getCommand(commandKey: string): Promise<StoredCommand | null> {
    const row = await this.db.prepare(
      `SELECT command_key, command_type, request_hash, status, result, correlation_id
       FROM command_log WHERE command_key = ?`,
    ).bind(commandKey).first<CommandRow>();
    // IN_FLIGHT reads as absent, matching D1WorkCaseStore: a command that never
    // completed is not a result to replay.
    if (!row || row.status === "IN_FLIGHT") return null;
    return {
      commandKey: row.command_key, commandType: row.command_type, requestHash: row.request_hash,
      status: row.status, result: row.result, correlationId: row.correlation_id,
    };
  }

  async openAtomic(input: { commitment: StoredCommitment; command: StoredCommand; event: CommitmentEvent }) {
    const c = input.commitment;
    const now = c.state.updatedAt;
    await this.db.batch([
      this.insertCommand(input.command, now),
      this.db.prepare(
        `INSERT INTO commitments
         (job_order_id, work_case_id, policy_name, provider_accepted, mobilization_started_at,
          work_started_at, frozen_at, state_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
      ).bind(c.state.jobOrderId, c.workCaseId, c.policyName, c.providerAccepted ? 1 : 0, c.stateVersion, now, now),
      ...c.state.reservations.map(r => this.insertReservation(c.state.jobOrderId, r)),
      this.insertEvent(input.event),
      this.finishCommand(input.command, now),
    ]);
  }

  async saveAtomic(input: {
    previous: StoredCommitment; next: StoredCommitment;
    preparation?: readonly PreparationRecord[];
    command: StoredCommand; event: CommitmentEvent;
  }) {
    const n = input.next;
    const now = n.state.updatedAt;
    await this.db.batch([
      this.insertCommand(input.command, now),
      // The version predicate is the optimistic-concurrency check. A write that
      // matches nothing means someone else moved the row first.
      this.db.prepare(
        `UPDATE commitments
         SET provider_accepted = ?, mobilization_started_at = ?, work_started_at = ?,
             frozen_at = ?, state_version = ?, updated_at = ?
         WHERE job_order_id = ? AND state_version = ?`,
      ).bind(
        n.providerAccepted ? 1 : 0, n.mobilizationStartedAt, n.workStartedAt,
        n.state.frozen ? now : null, n.stateVersion, now,
        n.state.jobOrderId, input.previous.stateVersion,
      ),
      ...n.state.reservations.map(r => this.db.prepare(
        `UPDATE capacity_reservations SET minutes_reallocated = ?, status = ? WHERE reservation_id = ?`,
      ).bind(r.minutesReallocated, r.status, r.reservationId)),
      ...(input.preparation ?? []).map(p => this.db.prepare(
        `INSERT INTO preparation_records
         (reservation_id, preparation_minutes, mobilization_minutes, external_cost_refs_json, recorded_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(reservation_id) DO UPDATE SET
           preparation_minutes = excluded.preparation_minutes,
           mobilization_minutes = excluded.mobilization_minutes,
           external_cost_refs_json = excluded.external_cost_refs_json`,
      ).bind(p.reservationId, p.preparationMinutes, p.mobilizationMinutes, JSON.stringify(p.externalCostRefs), now)),
      this.insertEvent(input.event),
      this.finishCommand(input.command, now),
    ]);
  }

  // -------------------------------------------------------------------------

  private insertReservation(jobOrderId: string, r: CapacityReservation): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO capacity_reservations
       (reservation_id, job_order_id, role, assignee_ref, minutes_reserved, minutes_reallocated, starts_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(r.reservationId, jobOrderId, r.role, r.assigneeRef, r.minutesReserved, r.minutesReallocated, r.startsAt, r.status);
  }

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

  private insertEvent(e: CommitmentEvent): D1PreparedStatementLike {
    return this.db.prepare(
      `INSERT INTO work_order_events (work_order_id, event_type, title, detail, actor, created_at)
       SELECT id, ?, ?, ?, 'system', ? FROM work_orders WHERE job_order_id = ?`,
    ).bind(e.eventType, e.eventType, e.payload, e.occurredAt, e.jobOrderId);
  }
}

function safeArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}
