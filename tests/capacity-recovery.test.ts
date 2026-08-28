/**
 * L5 answering L7.
 *
 * The property under test is not "backfill is computed correctly" but something
 * stricter: backfill is only ever claimed where there is evidence of a real
 * reallocation. Both directions of error move money, so a guess is never safe.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { loadCapacityRecovery, NO_RECOVERY_EVIDENCE } from "../lib/application/capacity-recovery";
import type { D1DatabaseLike } from "../lib/application/d1-requirement-contract-store";
import type { CommitmentSnapshot } from "../lib/layers/l7/cancellation";

const START = "2026-09-10T14:00:00.000Z";

const snapshot: CommitmentSnapshot = Object.freeze({
  jobOrderId: "JOB-1",
  takenAt: START,
  stage: "CAPACITY_LOCKED",
  reservations: Object.freeze([
    { reservationId: "RES-lead", role: "lead", assigneeRef: "ex-lead", minutesReserved: 240, startsAt: START, status: "HELD" as const, minutesReallocated: 0 },
    { reservationId: "RES-helper", role: "helper", assigneeRef: "ex-helper", minutesReserved: 240, startsAt: START, status: "HELD" as const, minutesReallocated: 0 },
  ]),
  reservedMinutesByRole: Object.freeze({ lead: 240, helper: 240 }),
});

/**
 * A database that answers the two queries and records what it was asked.
 * Keyed by which table the SQL touches, so a query rewrite that changes the
 * evidence requirement fails loudly rather than silently returning nothing.
 */
function fakeDb(rows: { overlaps?: unknown[]; busy?: unknown[] }) {
  const seen: string[] = [];
  const db = {
    prepare(sql: string) {
      seen.push(sql.replace(/\s+/g, " ").trim());
      const isBusy = /SELECT DISTINCT/i.test(sql);
      return {
        bind: () => ({
          all: async () => ({ results: (isBusy ? rows.busy : rows.overlaps) ?? [] }),
          first: async () => null,
          run: async () => undefined,
        }),
      };
    },
    batch: async () => [],
  };
  return { db: db as unknown as D1DatabaseLike, seen };
}

// ---------------------------------------------------------------------------

test("no evidence of rebooking means no backfill, and the loss is real", async () => {
  const { db } = fakeDb({});
  const ports = await loadCapacityRecovery({ db, jobOrderId: "JOB-1" });
  assert.deepEqual(ports.attemptBackfill({ snapshot }), [],
    "an absent reallocation is zero recovered, not an estimate");
});

test("only reservations with real rebooked minutes are claimed", async () => {
  const { db } = fakeDb({
    overlaps: [{ assignee_ref: "ex-lead", reservation_id: "RES-lead", minutes: 180 }],
  });
  const ports = await loadCapacityRecovery({ db, jobOrderId: "JOB-1" });
  assert.deepEqual(ports.attemptBackfill({ snapshot }), [{ reservationId: "RES-lead", minutes: 180 }],
    "the helper had nothing else booked, so nothing is claimed for them");
});

test("backfill never exceeds what was reserved", async () => {
  // The executor is committed to a longer job elsewhere. Only the overlap with
  // THIS reservation was recovered; claiming more would protect the provider
  // for less than they lost, and recordReallocation would reject it outright.
  const { db } = fakeDb({
    overlaps: [{ assignee_ref: "ex-lead", reservation_id: "RES-lead", minutes: 600 }],
  });
  const ports = await loadCapacityRecovery({ db, jobOrderId: "JOB-1" });
  assert.deepEqual(ports.attemptBackfill({ snapshot }), [{ reservationId: "RES-lead", minutes: 240 }]);
});

test("zero or negative rebooked minutes are not claimed at all", async () => {
  const { db } = fakeDb({
    overlaps: [
      { assignee_ref: "ex-lead", reservation_id: "RES-lead", minutes: 0 },
      { assignee_ref: "ex-helper", reservation_id: "RES-helper", minutes: -30 },
    ],
  });
  const ports = await loadCapacityRecovery({ db, jobOrderId: "JOB-1" });
  assert.deepEqual(ports.attemptBackfill({ snapshot }), []);
});

test("the backfill query requires an ACCEPTED assignment as its evidence", async () => {
  const { db, seen } = fakeDb({});
  await loadCapacityRecovery({ db, jobOrderId: "JOB-1" });
  const backfillQuery = seen.find(s => /capacity_reservations/i.test(s) && !/SELECT DISTINCT/i.test(s));
  assert.ok(backfillQuery, "a backfill query must have been issued");
  assert.match(backfillQuery!, /a\.status = 'accepted'/,
    "an offer is not a reallocation; the evidence requirement must stay in the query");
  assert.match(backfillQuery!, /other\.job_order_id <> r\.job_order_id/,
    "capacity given to the same job is not capacity recovered");
});

test("reschedule offers are empty unless slots were proposed", async () => {
  const { db } = fakeDb({});
  const ports = await loadCapacityRecovery({ db, jobOrderId: "JOB-1" });
  assert.deepEqual(ports.rescheduleOptions({ snapshot }), []);
});

test("a slot the team is already committed to is offered as neither feasible nor same-team", async () => {
  const clash = "2026-09-12T14:00:00.000Z";
  const free = "2026-09-13T09:00:00.000Z";
  const { db } = fakeDb({ busy: [{ starts_at: clash }] });
  const ports = await loadCapacityRecovery({
    db, jobOrderId: "JOB-1", candidateSlots: [clash, free],
  });
  const offers = ports.rescheduleOptions({ snapshot });
  assert.deepEqual(offers, [
    { startsAt: clash, sameTeam: false, feasible: false },
    { startsAt: free, sameTeam: true, feasible: true },
  ]);
});

test("reschedule may be optimistic where backfill may not", () => {
  // Stated as a test so the asymmetry is not quietly 'tidied up' later: an
  // offer that does not suit costs nobody anything; a wrong backfill number
  // moves money between the provider and the customer.
  assert.deepEqual(NO_RECOVERY_EVIDENCE.attemptBackfill({ snapshot }), []);
  assert.deepEqual(NO_RECOVERY_EVIDENCE.rescheduleOptions({ snapshot }), []);
});

test("the route cannot smuggle backfill through the request body", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../app/api/execution/route.ts", import.meta.url), "utf-8");
  assert.ok(!/attemptBackfill:\s*\(\)\s*=>\s*as/.test(src),
    "backfill must come from evidence, never from the caller");
  assert.match(src, /loadCapacityRecovery/,
    "the cancel action must use the evidenced recovery ports");
  assert.ok(!src.includes("body.backfill"),
    "the request body must not be able to state how much capacity was recovered");
});
