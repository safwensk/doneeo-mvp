"use client";

/**
 * The execution console.
 *
 * Everything from L6 through L12 was built as API routes with no screen, which
 * made it real but not visible. This is the screen: one job, walked step by
 * step, showing what each layer actually decided and why.
 *
 * It is deliberately not a customer UI. A customer never sees a bearer, an
 * impact class or a trial balance. This is the operator's view — the one that
 * makes it possible to check that the architecture does what it claims before
 * anyone builds a pretty version on top.
 */

import { useState } from "react";

type StepState = "idle" | "running" | "ok" | "error";
type Result = {
  status: number;
  body: Record<string, unknown>;
  at: string;
};

const NOW = "2026-09-10T08:00:00.000Z";
const START = "2026-09-10T14:00:00.000Z";
const ON_SITE = "2026-09-10T14:20:00.000Z";

const cents = (m: unknown): string => {
  const v = m as { minorUnits?: number } | undefined;
  return typeof v?.minorUnits === "number" ? `$${(v.minorUnits / 100).toFixed(2)}` : "—";
};

const snapshot = (ref: string, labour: number) => ({
  fulfillmentOptionRef: ref,
  components: [
    { kind: "LABOUR", label: "Crew", amount: { minorUnits: labour, currency: "CAD" }, sourceRef: "FUL" },
    {
      kind: "RENTAL", label: "Van rental",
      amount: { minorUnits: 9000, currency: "CAD" }, sourceRef: "RENT-1",
      validUntil: "2026-09-20T00:00:00.000Z",
    },
  ],
  missing: [],
  takenAt: NOW,
});

/** Each step names the layer that owns the decision, not the endpoint. */
type Step = {
  id: string;
  layer: string;
  title: string;
  why: string;
  path: string;
  method?: "GET" | "POST";
  body?: (ctx: Record<string, Result>) => unknown;
  summary: (b: Record<string, never> & Record<string, unknown>) => [string, string][];
};

const STEPS: Step[] = [
  {
    id: "seed", layer: "setup", title: "Reset and seed one job",
    why: "Two executors who accepted, a published RequirementContract at v3. Clears prior runs so this is repeatable.",
    path: "/api/operations",
    body: () => ({ action: "seed_console_demo" }),
    summary: b => [
      ["Job", String(b.jobOrderId ?? "—")],
      ["Crew", (b.crew as string[] ?? []).join(", ")],
      ["Fixture", String(b.note ?? "—")],
    ],
  },
  {
    id: "offer", layer: "L6", title: "Price two real configurations",
    why: "Options must differ by actual crew and equipment, not by margin on the same work.",
    path: "/api/offer",
    body: () => ({
      action: "create_offer", offerId: "OF-1", workCaseId: "WC-1",
      requirementContractRef: "RC-1", requirementContractVersion: 3,
      jurisdiction: "QC", riskProfile: "standard", now: NOW,
      options: [
        { band: "BUDGET", snapshot: snapshot("FUL-BUDGET", 18000), differsBy: "Two movers, no stair protection" },
        { band: "RECOMMENDED", snapshot: snapshot("FUL-1", 24000), differsBy: "Two movers plus floor and rail protection" },
      ],
      scopeContract: {
        scopeContractId: "SC-1", requirementContractRef: "RC-1", fulfillmentOptionRef: "FUL-1",
        inclusions: ["Load, carry and place the couch"],
        exclusions: ["Disassembly of built-in fixtures"],
        assumptions: ["Stairwell is clear"],
        allowance: { maxVariance: { minorUnits: 2500, currency: "CAD" }, appliesTo: ["TRAVEL"], requiresApprovalBeyond: true },
        createdAt: NOW,
      },
      profile: { payerType: "HOUSEHOLD", hasApprovedCredit: false, isRecurringCustomer: false },
      validFrom: NOW, validUntil: "2026-09-17T00:00:00.000Z",
    }),
    summary: b => [
      ...(b.options as { band: string; total: unknown }[] ?? []).map(o => [o.band, cents(o.total)] as [string, string]),
      ["Payment topology", String(b.paymentTopology ?? "—")],
      ["Is final settlement", String(b.isFinalSettlement)],
    ],
  },
  {
    id: "select", layer: "L6", title: "Customer chooses, L7 takes over",
    why: "Selection is gated on validity, the current RequirementContract version, and review status.",
    path: "/api/offer",
    body: () => ({ action: "select_offer", offerId: "OF-1", band: "RECOMMENDED", now: NOW }),
    summary: b => [["Band", String(b.band ?? "—")], ["Total", cents(b.total)], ["Next", String(b.next ?? "—")]],
  },
  {
    id: "hold", layer: "L7", title: "Hold capacity against accepted people",
    why: "One reservation per accepted role. An offer nobody took has cost nobody anything.",
    path: "/api/execution",
    body: () => ({
      action: "hold_capacity", commandKey: "cmd-hold", jobOrderId: "JOB-1",
      workCaseId: "WC-1", startsAt: START, minutesPerRole: 240, now: NOW,
    }),
    summary: b => [
      ["Stage", String(b.stage ?? "—")],
      ["Reservations", (b.reservations as { role: string; minutesReserved: number }[] ?? [])
        .map(r => `${r.role} ${r.minutesReserved}m`).join(", ")],
    ],
  },
  {
    id: "start", layer: "L7", title: "Work begins",
    why: "WORK_STARTED was unreachable until a live run exposed that the stage derived from itself.",
    path: "/api/execution",
    body: ctx => ({
      action: "start_work", commandKey: "cmd-start", jobOrderId: "JOB-1",
      expectedVersion: (ctx.hold?.body.stateVersion as number) ?? 1, now: START,
    }),
    summary: b => [["Stage", String(b.stage ?? "—")], ["Started at", String(b.workStartedAt ?? "—")]],
  },
  {
    id: "open", layer: "L09A", title: "Site disagrees with the plan",
    why: "One open RealityCase per job. A second disruption joins it rather than competing with it.",
    path: "/api/execution",
    body: () => ({
      action: "open_reality_case", commandKey: "cmd-rc", realityCaseId: "RC-CASE-1",
      workCaseId: "WC-1", jobOrderId: "JOB-1", now: ON_SITE,
    }),
    summary: b => [["Case", String(b.realityCaseId ?? "—")], ["Status", String(b.status ?? "—")]],
  },
  {
    id: "observe", layer: "L09A", title: "Classify what was found",
    why: "Read from a structured fact key, never the executor's prose. OR-1 is still open.",
    path: "/api/execution",
    body: ctx => ({
      action: "record_observation", commandKey: "cmd-obs", realityCaseId: "RC-CASE-1",
      expectedVersion: (ctx.open?.body.stateVersion as number) ?? 1,
      observationId: "OB-1", taskId: "T-2", observedBy: "ex-lead",
      statement: "stairwell is narrower than recorded", evidenceRefs: ["photo-1"],
      plannedStatement: "carry the couch up the stairs",
      changedFacts: [{
        factKey: "condition.stair_width", supersededValue: "900mm",
        newValue: "680mm", evidenceRefs: ["photo-1"],
      }],
      now: ON_SITE,
    }),
    summary: b => [
      ["Impact", String(b.impact ?? "—")],
      ["Needs a person", String(b.needsHumanReview)],
      ["Why", String(b.rationale ?? "—")],
    ],
  },
  {
    id: "recover", layer: "L09A", title: "Walk the recovery hierarchy",
    why: "Ten options, cheapest preservation first. Cancellation is only reachable when nothing else is.",
    path: "/api/execution",
    body: ctx => ({
      action: "decide_recovery", commandKey: "cmd-rec", realityCaseId: "RC-CASE-1",
      expectedVersion: (ctx.observe?.body.stateVersion as number) ?? 2,
      allTaskIds: ["T-1", "T-2"], dependsOn: { "T-2": ["T-1"] },
      availableOptions: [], now: ON_SITE,
    }),
    summary: b => [
      ["Options considered", String((b.considered as unknown[] ?? []).length)],
      ["Unrecoverable", String(b.unrecoverable)],
      ["Routes to", (b.routeTo as string[] ?? []).join(", ")],
    ],
  },
  {
    id: "cancel", layer: "L7", title: "Cancel, measuring loss after backfill",
    why: "Backfill runs before loss is measured. Reallocated capacity is not lost capacity.",
    path: "/api/execution",
    body: ctx => ({
      action: "cancel", commandKey: "cmd-cancel", jobOrderId: "JOB-1",
      expectedVersion: (ctx.start?.body.stateVersion as number) ?? 2,
      cause: "FIELD_REALITY_UNRECOVERABLE", requestedBy: "SYSTEM", now: "2026-09-10T14:30:00.000Z",
    }),
    summary: b => [
      ["Sequence", (b.steps as string[] ?? []).join(" → ")],
      ["Stage at request", String(b.stageAtRequest ?? "—")],
      ["Net lost", JSON.stringify(b.netLostByRole ?? {})],
      ["Charges full unperformed job", String(b.chargesFullUnperformedJob)],
    ],
  },
  {
    id: "responsibility", layer: "L09B", title: "Who bears it",
    why: "A hidden condition alone never creates customer liability. Protection follows performance.",
    path: "/api/execution",
    body: ctx => ({
      action: "settle", commandKey: "cmd-resp", assessmentId: "AS-1",
      jobOrderId: "JOB-1", realityCaseId: "RC-CASE-1", cause: "HIDDEN_CONDITION",
      customerTest: {
        materialFact: false, doneeoAskedOrDisclosedImportance: true, customerCouldReasonablyKnow: false,
        inaccurateOrOmitted: false, causalLink: true, doneeoShouldHaveAsked: false,
        doneeoIgnoredContradictoryEvidence: false,
      },
      providerTest: { metObligations: true, preparedAsAgreed: true, executedAsAgreed: true, evidenceRefs: ["photo-1"] },
      doneeoTest: { planningError: false, systemOrMarketplaceFailure: false, partnerFailureUnderDoneeoContract: false },
      disputed: false, evidenceRefs: ["photo-1"],
      eligibleCosts: (ctx.cancel?.body.eligibleCosts as unknown[]) ?? [],
      now: "2026-09-10T14:35:00.000Z",
    }),
    summary: b => {
      const i = b.instruction as Record<string, { minutes: number }> | null;
      return [
        ["Needs review", String(b.requiresReview)],
        ["Customer bears", i ? `${i.customerRealityAdjustment.minutes} min` : "—"],
        ["Provider protected", i ? `${i.protectedProviderPayable.minutes} min` : "—"],
        ["Doneeo absorbs", i ? `${i.doneeoAbsorption.minutes} min` : "—"],
      ];
    },
  },
  {
    id: "settlement", layer: "L12", title: "Minutes become money",
    why: "Customer charge and provider payable are computed by functions that cannot see each other.",
    path: "/api/settlement",
    body: ctx => {
      const i = ctx.responsibility?.body.instruction as Record<string, { byRole: Record<string, number> }> | null;
      const offer = ctx.offer?.body.options as { band: string; total: unknown }[] ?? [];
      const contracted = offer.find(o => o.band === "RECOMMENDED")?.total ?? { minorUnits: 40000, currency: "CAD" };
      return {
        action: "settle", jobOrderId: "JOB-1", transactionId: "SETTLE-JOB-1",
        providerShareOfCompleted: 0.7, now: "2026-09-10T14:40:00.000Z",
        settlementInput: {
          jobOrderId: "JOB-1", contractedPrice: contracted, completedFraction: 0,
          approvedAdditions: [],
          customerAdjustmentByRole: i?.customerRealityAdjustment.byRole ?? {},
          protectedProviderByRole: i?.protectedProviderPayable.byRole ?? {},
          doneeoAbsorptionByRole: i?.doneeoAbsorption.byRole ?? {},
          recoveryCreditByRole: {}, eligibleExternalCosts: [], taxes: [],
          taxDecisionRef: "QC-2026", requiresReview: false,
        },
      };
    },
    summary: b => [
      ["Customer pays", cents((b.customerCharge as Record<string, unknown>)?.total)],
      ["Provider paid", cents((b.providerPayable as Record<string, unknown>)?.total)],
      ["Doneeo position", cents(b.doneeoPosition)],
      ["Entries", (b.entries as { direction: string; account: string }[] ?? [])
        .map(e => `${e.direction[0]} ${e.account}`).join(", ")],
    ],
  },
  {
    id: "authorize", layer: "L12", title: "Place a card hold",
    why: "An authorization is a ceiling and a memo. It is not revenue and not a receivable.",
    path: "/api/settlement",
    body: ctx => {
      const offer = ctx.offer?.body.options as { band: string; total: { minorUnits: number } }[] ?? [];
      const total = offer.find(o => o.band === "RECOMMENDED")?.total.minorUnits ?? 40000;
      return {
        action: "authorize", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
        amountMinorUnits: total, pspRef: "psp_auth_1", now: NOW,
      };
    },
    summary: b => [["Authorized", cents(b.authorized)], ["Status", String(b.status ?? "—")]],
  },
  {
    id: "capture", layer: "L12", title: "Capture $50 — PSP event evt_777",
    why: "The transaction id is derived from the PSP event id, so a replay collides at the database.",
    path: "/api/settlement",
    body: () => ({
      action: "capture", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
      amountMinorUnits: 5000, pspEventId: "evt_777", pspRef: "psp_cap_1",
      now: "2026-09-10T14:45:00.000Z",
    }),
    summary: b => [
      ["Transaction", String(b.transactionId ?? "—")],
      ["Replayed", String(b.replayed)],
      ["Captured", cents((b.authorization as Record<string, unknown>)?.captured)],
    ],
  },
  {
    id: "replay", layer: "L12", title: "The SAME callback again",
    why: "Networks retry and webhooks replay. This must move no money, and say so rather than erroring.",
    path: "/api/settlement",
    body: () => ({
      action: "capture", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
      amountMinorUnits: 5000, pspEventId: "evt_777", pspRef: "psp_cap_1",
      now: "2026-09-10T14:45:30.000Z",
    }),
    summary: b => [
      ["Transaction", String(b.transactionId ?? "—")],
      ["Replayed", String(b.replayed)],
      ["Captured (unchanged)", cents((b.authorization as Record<string, unknown>)?.captured)],
    ],
  },
  {
    id: "release", layer: "L12", title: "Release the unused hold",
    why: "Posts nothing. A live run showed that reversing a hold invented negative revenue from nothing.",
    path: "/api/settlement",
    body: () => ({
      action: "release", jobOrderId: "JOB-1", authorizationId: "AUTH-1",
      pspEventId: "evt_778", pspRef: "psp_rel_1", now: "2026-09-10T14:50:00.000Z",
    }),
    summary: b => [
      ["Ledger transaction", b.transactionId ? String(b.transactionId) : "none — a hold is a memo"],
      ["Released", cents((b.authorization as Record<string, unknown>)?.released)],
      ["Status", String((b.authorization as Record<string, unknown>)?.status ?? "—")],
    ],
  },
  {
    id: "ledger", layer: "L12", title: "The ledger, folded from entries",
    why: "No balance is stored anywhere. Every figure here is summed from postings on read.",
    path: "/api/settlement?jobOrderId=JOB-1", method: "GET",
    summary: b => [
      ["Transactions", String((b.transactions as unknown[] ?? []).length)],
      ["Trial balance", JSON.stringify(b.trialBalance ?? {})],
      ["Customer outstanding", cents(b.customerOutstanding)],
      ["Provider outstanding", cents(b.providerOutstanding)],
    ],
  },
];

export default function ConsolePage() {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [states, setStates] = useState<Record<string, StepState>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function runStep(step: Step, ctx: Record<string, Result>): Promise<Result> {
    setStates(s => ({ ...s, [step.id]: "running" }));
    const res = await fetch(step.path, {
      method: step.method ?? "POST",
      headers: { "content-type": "application/json" },
      body: step.method === "GET" ? undefined : JSON.stringify(step.body?.(ctx) ?? {}),
    });
    let body: Record<string, unknown>;
    try { body = await res.json() as Record<string, unknown>; }
    catch { body = { error: "response was not JSON" }; }

    const result: Result = { status: res.status, body, at: new Date().toISOString() };
    setResults(r => ({ ...r, [step.id]: result }));
    setStates(s => ({ ...s, [step.id]: res.status < 400 ? "ok" : "error" }));
    return result;
  }

  async function runAll() {
    setBusy(true);
    setResults({}); setStates({});
    const ctx: Record<string, Result> = {};
    for (const step of STEPS) {
      const r = await runStep(step, ctx);
      ctx[step.id] = r;
      // A failed step usually invalidates everything after it — stop rather
      // than producing a cascade of confusing errors.
      if (r.status >= 400) break;
    }
    setBusy(false);
  }

  const ran = Object.keys(results).length;
  const failed = Object.values(states).filter(s => s === "error").length;

  return (
    <main className="console">
      <header>
        <div>
          <small>OPERATOR VIEW</small>
          <h1>Execution console</h1>
          <p>
            One job, walked through every layer that decides something about it. This is not a
            customer screen — it shows the reasoning, not the outcome.
          </p>
        </div>
        <div className="console-actions">
          <button onClick={runAll} disabled={busy}>
            {busy ? "Running…" : ran ? "Run again" : "Run the whole chain"}
          </button>
          {ran > 0 && (
            <span className={failed ? "tally bad" : "tally good"}>
              {ran} step{ran === 1 ? "" : "s"} · {failed} failed
            </span>
          )}
        </div>
      </header>

      <p className="console-note">
        Each step calls the same API the product uses. Nothing here is mocked — a red step is a
        real refusal, and the invariant that caused it is shown.
      </p>

      <ol className="steps">
        {STEPS.map(step => {
          const state = states[step.id] ?? "idle";
          const result = results[step.id];
          return (
            <li key={step.id} className={`step ${state}`}>
              <div className="step-head">
                <span className="layer">{step.layer}</span>
                <div className="step-title">
                  <strong>{step.title}</strong>
                  <small>{step.why}</small>
                </div>
                <span className={`badge ${state}`}>
                  {state === "idle" ? "—" : state === "running" ? "…" : result?.status}
                </span>
              </div>

              {result && (
                <div className="step-body">
                  <dl>
                    {step.summary(result.body as Record<string, never> & Record<string, unknown>).map(([k, v]) => (
                      <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>
                    ))}
                  </dl>
                  {result.status >= 400 && (
                    <p className="refusal">
                      <strong>{String(result.body.invariant ?? result.body.code ?? "refused")}</strong>
                      {" — "}{String(result.body.error ?? "")}
                    </p>
                  )}
                  <button className="raw" onClick={() => setOpen(o => ({ ...o, [step.id]: !o[step.id] }))}>
                    {open[step.id] ? "Hide" : "Show"} raw response
                  </button>
                  {open[step.id] && <pre>{JSON.stringify(result.body, null, 2)}</pre>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
