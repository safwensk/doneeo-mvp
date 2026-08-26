/**
 * L5 answering L7: what could actually absorb this capacity, and when could
 * the same team come back.
 *
 * These were the caller's job until now, which was the honest gap in the first
 * wiring pass. A caller who supplies backfill supplies the number that decides
 * how much money moves.
 *
 * WHY BACKFILL IS EVIDENCED AND NEVER ESTIMATED
 *
 * Net Lost Reserved Capacity = Reserved − Successfully Reallocated, so backfill
 * moves money in both directions at once:
 *
 *   overstate it  → net loss falls  → the provider is protected for less than
 *                                     they actually lost
 *   understate it → net loss rises  → the customer is asked to bear time the
 *                                     provider did not really lose
 *
 * There is no safe direction to guess in, so this module does not guess. It
 * counts minutes an executor is *actually committed to elsewhere* in the freed
 * window — a real accepted assignment on another JobOrder. Plausible demand,
 * open work orders and likely rebookings are not reallocation. If nothing was
 * genuinely rebooked, backfill is zero and the loss is real.
 *
 * Reschedule options are the opposite case and may be optimistic: an offer that
 * turns out not to suit costs nobody anything, and canon asks for retention to
 * be attempted before closure.
 */

import type { CommitmentSnapshot, RescheduleOption } from "../layers/l7/cancellation";
import type { D1DatabaseLike } from "./d1-requirement-contract-store";

/** What L7's CancellationPorts needs, minus the policy it already holds. */
export type CapacityRecoveryPorts = {
  rescheduleOptions(input: { snapshot: CommitmentSnapshot }): readonly RescheduleOption[];
  attemptBackfill(input: { snapshot: CommitmentSnapshot }): readonly { reservationId: string; minutes: number }[];
};

type OverlapRow = {
  assignee_ref: string;
  reservation_id: string;
  minutes: number;
};
type BusyRow = { starts_at: string };

/**
 * Reads the facts once, up front.
 *
 * L7's ports are synchronous — cancellation is a single decision taken against
 * one consistent picture, not a sequence of lookups that could each see a
 * different world. So the async work happens here and the returned ports are
 * pure functions over what was read.
 */
export async function loadCapacityRecovery(input: {
  db: D1DatabaseLike;
  jobOrderId: string;
  /** Candidate return slots, newest plan first. Supplied by scheduling. */
  candidateSlots?: readonly string[];
}): Promise<CapacityRecoveryPorts> {
  const { db, jobOrderId } = input;

  // Minutes each of this job's people is already committed to on OTHER jobs.
  // `a.status = 'accepted'` is the evidence requirement: an offer is not a
  // reallocation, and neither is an open work order that merely needs the role.
  const overlaps = await db.prepare(
    `SELECT r.assignee_ref, r.reservation_id,
            COALESCE(SUM(other.minutes_reserved), 0) AS minutes
       FROM capacity_reservations r
       LEFT JOIN capacity_reservations other
              ON other.assignee_ref = r.assignee_ref
             AND other.job_order_id <> r.job_order_id
             AND other.status IN ('HELD','CONSUMED')
       LEFT JOIN assignments a
              ON a.executor_id = other.assignee_ref
             AND a.status = 'accepted'
      WHERE r.job_order_id = ?
        AND a.id IS NOT NULL
      GROUP BY r.assignee_ref, r.reservation_id`,
  ).bind(jobOrderId).all<OverlapRow>();

  const rebooked = new Map<string, number>();
  for (const row of overlaps.results ?? []) {
    rebooked.set(row.reservation_id, Number(row.minutes) || 0);
  }

  // When the team is next NOT committed. Used only to mark an offered slot as
  // same-team; being wrong here costs an offer, not money.
  const busy = await db.prepare(
    `SELECT DISTINCT other.starts_at
       FROM capacity_reservations r
       JOIN capacity_reservations other
         ON other.assignee_ref = r.assignee_ref
        AND other.job_order_id <> r.job_order_id
        AND other.status IN ('HELD','CONSUMED')
      WHERE r.job_order_id = ?`,
  ).bind(jobOrderId).all<BusyRow>();
  const busyAt = new Set((busy.results ?? []).map(b => b.starts_at));

  return {
    attemptBackfill({ snapshot }) {
      const out: { reservationId: string; minutes: number }[] = [];
      for (const r of snapshot.reservations) {
        const elsewhere = rebooked.get(r.reservationId) ?? 0;
        if (elsewhere <= 0) continue;
        // Never claim more was recovered than was reserved. recordReallocation
        // would reject it anyway; failing here would abort a cancellation the
        // customer already asked for.
        out.push({ reservationId: r.reservationId, minutes: Math.min(elsewhere, r.minutesReserved) });
      }
      return out;
    },

    rescheduleOptions({ snapshot }) {
      const slots = input.candidateSlots ?? [];
      if (slots.length === 0) return [];
      const originalRoles = new Set(snapshot.reservations.map(r => r.role));
      return slots.map(startsAt => ({
        startsAt,
        // The same people can come back if none of them is already committed
        // at that time. Canon: same provider, team and resources first.
        sameTeam: !busyAt.has(startsAt) && originalRoles.size > 0,
        feasible: !busyAt.has(startsAt),
      }));
    },
  };
}

/**
 * The ports for a job with nothing else on the books.
 *
 * Zero backfill and no reschedule offers is the correct answer when there is no
 * evidence of either, not a placeholder — it means the reserved time really was
 * lost. Kept explicit so a caller cannot pass caller-invented numbers instead.
 */
export const NO_RECOVERY_EVIDENCE: CapacityRecoveryPorts = Object.freeze({
  attemptBackfill: () => [],
  rescheduleOptions: () => [],
});
