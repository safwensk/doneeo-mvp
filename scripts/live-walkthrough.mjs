/**
 * Drive the real worker through a whole job, end to end.
 *
 * This is not a unit test. It builds a D1-compatible binding over SQLite,
 * applies every migration, seeds a real work order with accepted assignments,
 * and then makes actual HTTP requests to the built worker — the same
 * dist/server/index.js that Cloudflare would run.
 *
 *   node scripts/live-walkthrough.mjs
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// ---------------------------------------------------------------------------
// A D1 binding over node:sqlite
// ---------------------------------------------------------------------------

function makeD1(db) {
  const stmt = (sql) => ({
    bind: (...values) => ({
      first: async () => db.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...values) }),
      run: async () => db.prepare(sql).run(...values),
      __sql: sql,
      __values: values,
    }),
    first: async () => db.prepare(sql).get() ?? null,
    all: async () => ({ results: db.prepare(sql).all() }),
    run: async () => db.prepare(sql).run(),
    __sql: sql,
    __values: [],
  });

  return {
    prepare: stmt,
    // Real batches are atomic, and the atomicity is load-bearing: L12 relies on
    // a primary-key collision aborting the whole posting rather than leaving
    // half a transaction behind.
    batch: async (statements) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of statements) out.push(db.prepare(s.__sql).run(...s.__values));
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
for (const f of readdirSync("drizzle").filter(f => f.endsWith(".sql")).sort()) {
  for (const part of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) {
    const s = part.trim();
    if (s) db.exec(s);
  }
}

// ---------------------------------------------------------------------------
// Seed: one work case, two executors who accepted, one work order
// ---------------------------------------------------------------------------

const NOW = "2026-09-10T08:00:00.000Z";
const START = "2026-09-10T14:00:00.000Z";

db.exec(`
INSERT INTO work_cases (work_case_id, job_order_id, state, current_layer_id, state_version, created_at, updated_at)
VALUES ('WC-1','JOB-1','REQUIREMENT_READY','L06',3,'${NOW}','${NOW}');

INSERT INTO executors (id,name,profile_type,status,rating,completed_jobs,location,service_radius_km,team_size,lead_eligible,vehicle,hourly_rate)
VALUES ('ex-lead','Amélie','solo','available',4.9,120,'Montréal',20,1,1,'van',5700),
       ('ex-helper','Youssef','solo','available',4.7,64,'Montréal',20,1,0,'none',4200);

INSERT INTO work_orders (public_reference,work_case_id,job_order_id,request_text,category,city,required_team_size,price,status,created_at)
VALUES ('WO-1','WC-1','JOB-1','Move a couch to the third floor','moving','Montréal',2,0,'ready','${NOW}');

INSERT INTO assignments (work_order_id,executor_id,role,is_lead,status,offered_at,responded_at)
VALUES (1,'ex-lead','lead',1,'accepted','${NOW}','${NOW}'),
       (1,'ex-helper','helper',0,'accepted','${NOW}','${NOW}');

INSERT INTO requirement_contracts (contract_id,version,status,content,content_hash,published_at,correlation_id,created_at)
VALUES ('RC-1',3,'PUBLISHED','{}','hash-3','${NOW}','corr-1','${NOW}');
`);

// ---------------------------------------------------------------------------
// Drive the real worker
// ---------------------------------------------------------------------------

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("live", String(Date.now()));
const { default: worker } = await import(workerUrl.href);

const env = { DB: makeD1(db), ASSETS: { fetch: async () => new Response("nf", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

let step = 0;
async function call(method, path, body) {
  const res = await worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env, ctx,
  );
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

const money = m => `$${(m.minorUnits / 100).toFixed(2)}`;
function show(label, { status, json }, pick) {
  step += 1;
  const ok = status < 400 ? "OK " : "ERR";
  console.log(`\n${String(step).padStart(2)}. ${ok} ${status}  ${label}`);
  const detail = pick ? pick(json) : json;
  for (const [k, v] of Object.entries(detail ?? {})) {
    console.log(`      ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  if (status >= 400) console.log(`      ${JSON.stringify(json)}`);
  return json;
}

console.log("=".repeat(78));
console.log("DONEEO — live walkthrough against the built worker");
console.log("=".repeat(78));

// --- L6: price it -----------------------------------------------------------
const snapshot = (ref, labourCents) => ({
  fulfillmentOptionRef: ref,
  components: [
    { kind: "LABOUR", label: "Crew", amount: { minorUnits: labourCents, currency: "CAD" }, sourceRef: "FUL-1" },
    { kind: "RENTAL", label: "Van rental", amount: { minorUnits: 9000, currency: "CAD" }, sourceRef: "RENT-1", validUntil: "2026-09-20T00:00:00.000Z" },
  ],
  missing: [],
  takenAt: NOW,
});

const offer = show("L6  create_offer — two real configurations",
  await call("POST", "/api/offer", {
    action: "create_offer",
    offerId: "OF-1", workCaseId: "WC-1",
    requirementContractRef: "RC-1", requirementContractVersion: 3,
    jurisdiction: "QC", riskProfile: "standard",
    options: [
      { band: "BUDGET", snapshot: snapshot("FUL-BUDGET", 18000), differsBy: "Two movers, no stair protection" },
      { band: "RECOMMENDED", snapshot: snapshot("FUL-1", 24000), differsBy: "Two movers plus floor and rail protection" },
    ],
    scopeContract: {
      scopeContractId: "SC-1", requirementContractRef: "RC-1", fulfillmentOptionRef: "FUL-1",
      inclusions: ["Load, carry and place the couch"], exclusions: ["Disassembly of built-ins"],
      assumptions: ["Stairwell is clear"],
      allowance: { maxVariance: { minorUnits: 2500, currency: "CAD" }, appliesTo: ["TRAVEL"], requiresApprovalBeyond: true },
      createdAt: NOW,
    },
    profile: { payerType: "HOUSEHOLD", hasApprovedCredit: false, isRecurringCustomer: false },
    validFrom: NOW, validUntil: "2026-09-17T00:00:00.000Z",
    now: NOW,
  }),
  j => ({
    options: j.options?.map(o => `${o.band} ${money(o.total)}`).join("  |  "),
    paymentTopology: j.paymentTopology,
    isFinalSettlement: j.isFinalSettlement,
  }));

const contracted = offer.options?.find(o => o.band === "RECOMMENDED")?.total;

show("L6  select_offer — hands off to L7",
  await call("POST", "/api/offer", { action: "select_offer", offerId: "OF-1", band: "RECOMMENDED", now: NOW }),
  j => ({ band: j.band, total: j.total && money(j.total), next: j.next, isFinalSettlement: j.isFinalSettlement }));

// --- L7: commit -------------------------------------------------------------
const held = show("L7  hold_capacity — one reservation per ACCEPTED role",
  await call("POST", "/api/execution", {
    action: "hold_capacity", commandKey: "cmd-hold", jobOrderId: "JOB-1", workCaseId: "WC-1",
    startsAt: START, minutesPerRole: 240, now: NOW,
  }),
  j => ({ stage: j.stage, reservations: j.reservations?.map(r => `${r.role}:${r.minutesReserved}m`).join(" ") }));

show("L7  same stored state, different clock (GET uses real now)",
  await call("GET", "/api/execution?jobOrderId=JOB-1"),
  j => ({ stageNow: j.stage, policy: j.policy, note: "CAPACITY_LOCKED at 08:00 on 10 Sep; far outside the window today" }));

const started = show("L7  start_work — WORK_STARTED, the stage that used to be unreachable",
  await call("POST", "/api/execution", {
    action: "start_work", commandKey: "cmd-start", jobOrderId: "JOB-1",
    expectedVersion: held.stateVersion, now: START,
  }),
  j => ({ stage: j.stage, workStartedAt: j.workStartedAt }));

// --- L09A: reality ----------------------------------------------------------
const rc = show("L09A open_reality_case — the wall is not what the plan assumed",
  await call("POST", "/api/execution", {
    action: "open_reality_case", commandKey: "cmd-rc", realityCaseId: "RC-CASE-1",
    workCaseId: "WC-1", jobOrderId: "JOB-1", now: "2026-09-10T14:20:00.000Z",
  }),
  j => ({ realityCaseId: j.realityCaseId, status: j.status }));

const obs = show("L09A record_observation — classified from a structured fact key",
  await call("POST", "/api/execution", {
    action: "record_observation", commandKey: "cmd-obs", realityCaseId: "RC-CASE-1",
    expectedVersion: rc.stateVersion, observationId: "OB-1", taskId: "T-2",
    observedBy: "ex-lead", statement: "stairwell is narrower than recorded",
    evidenceRefs: ["photo-1"], plannedStatement: "carry the couch up the stairs",
    changedFacts: [{ factKey: "condition.stair_width", supersededValue: "900mm", newValue: "680mm", evidenceRefs: ["photo-1"] }],
    now: "2026-09-10T14:20:00.000Z",
  }),
  j => ({ impact: j.impact, needsHumanReview: j.needsHumanReview, rationale: j.rationale }));

const rec = show("L09A decide_recovery — nothing viable is offered",
  await call("POST", "/api/execution", {
    action: "decide_recovery", commandKey: "cmd-rec", realityCaseId: "RC-CASE-1",
    expectedVersion: obs.stateVersion, allTaskIds: ["T-1", "T-2"], dependsOn: { "T-2": ["T-1"] },
    availableOptions: [], now: "2026-09-10T14:25:00.000Z",
  }),
  j => ({ unrecoverable: j.unrecoverable, routeTo: j.routeTo, considered: j.considered?.length }));

// --- L7: cancel -------------------------------------------------------------
const cancelled = show("L7  cancel — backfill read from evidence, then loss measured",
  await call("POST", "/api/execution", {
    action: "cancel", commandKey: "cmd-cancel", jobOrderId: "JOB-1",
    expectedVersion: started.stateVersion, cause: "FIELD_REALITY_UNRECOVERABLE",
    requestedBy: "SYSTEM", now: "2026-09-10T14:30:00.000Z",
  }),
  j => ({ steps: j.steps?.join(" -> "), stageAtRequest: j.stageAtRequest,
          netLostByRole: j.netLostByRole, eligibleCosts: j.eligibleCosts?.length,
          chargesFullUnperformedJob: j.chargesFullUnperformedJob }));

// --- L09B: responsibility ---------------------------------------------------
const settledResp = show("L09B settle — a hidden condition is nobody's fault",
  await call("POST", "/api/execution", {
    action: "settle", commandKey: "cmd-resp", assessmentId: "AS-1",
    jobOrderId: "JOB-1", realityCaseId: "RC-CASE-1", cause: "HIDDEN_CONDITION",
    customerTest: { materialFact: false, doneeoAskedOrDisclosedImportance: true, customerCouldReasonablyKnow: false,
                    inaccurateOrOmitted: false, causalLink: true, doneeoShouldHaveAsked: false,
                    doneeoIgnoredContradictoryEvidence: false },
    providerTest: { metObligations: true, preparedAsAgreed: true, executedAsAgreed: true, evidenceRefs: ["photo-1"] },
    doneeoTest: { planningError: false, systemOrMarketplaceFailure: false, partnerFailureUnderDoneeoContract: false },
    disputed: false, evidenceRefs: ["photo-1"],
    eligibleCosts: cancelled.eligibleCosts ?? [],
    now: "2026-09-10T14:35:00.000Z",
  }),
  j => ({ requiresReview: j.requiresReview,
          customerBears: j.instruction && `${j.instruction.customerRealityAdjustment.minutes} min`,
          providerProtected: j.instruction && `${j.instruction.protectedProviderPayable.minutes} min`,
          doneeoAbsorbs: j.instruction && `${j.instruction.doneeoAbsorption.minutes} min`,
          chargesUnperformedWork: j.instruction?.chargesUnperformedWork }));

// --- L12: money -------------------------------------------------------------
const inst = settledResp.instruction;
const settlement = show("L12  settle — charge and payable computed independently",
  await call("POST", "/api/settlement", {
    action: "settle", jobOrderId: "JOB-1", transactionId: "SETTLE-JOB-1",
    providerShareOfCompleted: 0.7,
    settlementInput: {
      jobOrderId: "JOB-1",
      contractedPrice: contracted ?? { minorUnits: 40000, currency: "CAD" },
      completedFraction: 0,
      approvedAdditions: [],
      customerAdjustmentByRole: inst?.customerRealityAdjustment?.byRole ?? {},
      protectedProviderByRole: inst?.protectedProviderPayable?.byRole ?? {},
      doneeoAbsorptionByRole: inst?.doneeoAbsorption?.byRole ?? {},
      recoveryCreditByRole: {},
      eligibleExternalCosts: [],
      taxes: [],
      taxDecisionRef: "QC-2026",
      requiresReview: false,
    },
    now: "2026-09-10T14:40:00.000Z",
  }),
  j => ({ customerTotal: j.customerCharge && money(j.customerCharge.total),
          providerTotal: j.providerPayable && money(j.providerPayable.total),
          doneeoPosition: j.doneeoPosition && money(j.doneeoPosition),
          entries: j.entries?.map(e => `${e.direction[0]} ${e.account} ${money(e.amount)}`).join("  |  ") }));

show("L12  authorize a card hold",
  await call("POST", "/api/settlement", {
    action: "authorize", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
    amountMinorUnits: (contracted ?? { minorUnits: 40000 }).minorUnits,
    pspRef: "psp_auth_1", now: NOW,
  }),
  j => ({ authorized: j.authorized && money(j.authorized), status: j.status }));

const cap1 = show("L12  capture — PSP event evt_777",
  await call("POST", "/api/settlement", {
    action: "capture", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
    amountMinorUnits: 5000, pspEventId: "evt_777", pspRef: "psp_cap_1",
    now: "2026-09-10T14:45:00.000Z",
  }),
  j => ({ transactionId: j.transactionId, replayed: j.replayed, captured: j.authorization && money(j.authorization.captured) }));

const cap2 = show("L12  THE SAME callback delivered again — must move no money",
  await call("POST", "/api/settlement", {
    action: "capture", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
    amountMinorUnits: 5000, pspEventId: "evt_777", pspRef: "psp_cap_1",
    now: "2026-09-10T14:45:30.000Z",
  }),
  j => ({ transactionId: j.transactionId, replayed: j.replayed }));

show("L12  release the unused hold",
  await call("POST", "/api/settlement", {
    action: "release", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
    pspEventId: "evt_778", pspRef: "psp_rel_1", now: "2026-09-10T14:50:00.000Z",
  }),
  j => ({ released: j.authorization && money(j.authorization.released), status: j.authorization?.status }));

const ledger = show("L12  the ledger, folded from entries",
  await call("GET", "/api/settlement?jobOrderId=JOB-1"),
  j => ({ transactions: j.transactions?.length,
          trialBalance: j.trialBalance,
          customerOutstanding: j.customerOutstanding && money(j.customerOutstanding),
          providerOutstanding: j.providerOutstanding && money(j.providerOutstanding) }));

// --- Independent verification against the database itself -------------------
console.log("\n" + "=".repeat(78));
console.log("VERIFIED AGAINST THE DATABASE, not the responses");
console.log("=".repeat(78));

const rows = db.prepare(`
  SELECT direction, SUM(amount_minor_units) AS total
  FROM ledger_entries GROUP BY direction`).all();
const dr = rows.find(r => r.direction === "DEBIT")?.total ?? 0;
const cr = rows.find(r => r.direction === "CREDIT")?.total ?? 0;
console.log(`  debits ${dr}  credits ${cr}  ->  ${dr === cr ? "BALANCED" : "*** UNBALANCED ***"}`);

const caps = db.prepare(`SELECT COUNT(*) AS n FROM ledger_transactions WHERE kind='CAPTURE'`).get();
console.log(`  CAPTURE transactions after a duplicate callback: ${caps.n} ${caps.n === 1 ? "(replay moved nothing)" : "*** DUPLICATED ***"}`);

const facts = db.prepare(`SELECT fact_key, superseded_value, new_value FROM changed_facts`).all();
for (const f of facts) console.log(`  provenance kept: ${f.fact_key}  ${f.superseded_value} -> ${f.new_value}`);

const cls = db.prepare(`SELECT impact, classifier_name, needs_human_review FROM impact_classifications`).all();
for (const c of cls) console.log(`  classification: ${c.impact} by ${c.classifier_name}, review=${c.needs_human_review}`);

const res = db.prepare(`SELECT role, minutes_reserved, minutes_reallocated, status FROM capacity_reservations`).all();
for (const r of res) console.log(`  reservation: ${r.role} ${r.minutes_reserved}m reallocated=${r.minutes_reallocated} ${r.status}`);

console.log("");
