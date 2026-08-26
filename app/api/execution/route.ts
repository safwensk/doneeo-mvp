/**
 * The execution chain: L7 → L09A → L09B.
 *
 * Everything after planning. Commitment and capacity, what the site actually
 * turned out to be, and who bears the consequence when it differed.
 *
 * This route decides nothing. Each action hands stored state to the layer that
 * owns the decision and returns the layer's own frozen output, including its
 * reasoning — a caller can always see why, not just what. Thresholds come from
 * the pilot policy; none appear here.
 *
 * Backfill is NOT accepted from the request body. It decides how much money
 * moves between the provider and the customer, so it is read from real
 * reservations and accepted assignments — see lib/application/capacity-recovery.
 */

import { CommitmentService, CommitmentServiceError } from "../../../lib/application/commitment-service";
import { RealityService, RealityServiceError } from "../../../lib/application/reality-service";
import { SettlementService, SettlementServiceError } from "../../../lib/application/settlement-service";
import { D1CommitmentStore } from "../../../lib/application/d1-commitment-store";
import { D1RealityStore } from "../../../lib/application/d1-reality-store";
import type { D1DatabaseLike } from "../../../lib/application/d1-requirement-contract-store";
import { MONTREAL_PILOT } from "../../../lib/policy/montreal-pilot";
import { loadCapacityRecovery } from "../../../lib/application/capacity-recovery";
import { CommitmentInvariantError } from "../../../lib/layers/l7/commitment";
import { RealityInvariantError } from "../../../lib/layers/l09a/reality";
import { FairnessInvariantError } from "../../../lib/layers/l09b/responsibility";
import type { RecoverySearch, RecoveryOptionKind } from "../../../lib/layers/l09a/recovery";

export const runtime = "edge";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
type D1Binding = { prepare(q: string): D1Statement; batch(s: D1Statement[]): Promise<unknown[]> };

function getDatabase(): D1DatabaseLike {
  const db = (globalThis as typeof globalThis & { __DONEEO_DB__?: D1Binding }).__DONEEO_DB__;
  if (!db) throw new Error("Doneeo database binding is unavailable");
  return db as unknown as D1DatabaseLike;
}

function wire() {
  const db = getDatabase();
  const realityStore = new D1RealityStore(db);
  return {
    commitment: new CommitmentService(new D1CommitmentStore(db),
      { name: MONTREAL_PILOT.name, commitment: MONTREAL_PILOT.commitment }),
    reality: new RealityService(realityStore,
      { name: MONTREAL_PILOT.name, classifier: MONTREAL_PILOT.classifier }),
    settlement: new SettlementService(realityStore,
      { name: MONTREAL_PILOT.name, review: MONTREAL_PILOT.review }),
  };
}

/**
 * Which recovery options the caller reports as available.
 *
 * Unlike backfill, this is safe to take from the caller: it can only ever
 * narrow what the search may choose, and L09A still enforces the hierarchy
 * order — so a caller cannot promote a full replan over a viable local fix,
 * and cannot reach a last-resort option while a preserving one is viable.
 */
function searchFrom(viable: readonly string[]): RecoverySearch {
  const allowed = new Set(viable as RecoveryOptionKind[]);
  return {
    evaluate: ({ kind, affectedTaskIds }) => ({
      kind,
      taskIds: affectedTaskIds,
      viable: allowed.has(kind),
      reason: allowed.has(kind) ? `${kind} reported available` : `${kind} not reported available`,
      changesRequirement: kind === "TARGETED_REARCHITECTURE" || kind === "FULL_REPLAN",
      needsCustomerApproval: kind === "FULL_REPLAN" || kind === "CANCEL_AFFECTED_SCOPE",
    }),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobOrderId = url.searchParams.get("jobOrderId");
    const realityCaseId = url.searchParams.get("realityCaseId");
    const s = wire();
    const now = new Date().toISOString();

    if (jobOrderId) {
      const commitment = await s.commitment.read(jobOrderId);
      if (!commitment) return Response.json({ error: "No commitment for this JobOrder" }, { status: 404 });
      return Response.json({
        jobOrderId,
        // Recomputed, never read from storage. See CommitmentService.stageOf.
        stage: s.commitment.stageOf(commitment, now),
        policy: commitment.policyName,
        stateVersion: commitment.stateVersion,
        reservations: commitment.state.reservations,
        frozen: commitment.state.frozen,
        workStartedAt: commitment.workStartedAt,
      });
    }
    if (realityCaseId) {
      const stored = await s.reality.read(realityCaseId);
      if (!stored) return Response.json({ error: "No RealityCase" }, { status: 404 });
      return Response.json({ ...stored.realityCase, stateVersion: stored.stateVersion });
    }
    return Response.json({ error: "jobOrderId or realityCaseId is required" }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, never> & Record<string, unknown>;
    const action = String(body.action ?? "");
    const s = wire();
    const now = typeof body.now === "string" ? body.now : new Date().toISOString();
    const correlationId = String(body.correlationId ?? crypto.randomUUID());
    const commandKey = String(body.commandKey ?? crypto.randomUUID());

    switch (action) {
      // --- L7 ---------------------------------------------------------------
      case "hold_capacity": {
        const r = await s.commitment.holdCapacityForJob({
          commandKey,
          jobOrderId: String(body.jobOrderId),
          workCaseId: body.workCaseId ? String(body.workCaseId) : null,
          startsAt: String(body.startsAt),
          minutesPerRole: Number(body.minutesPerRole),
          correlationId, now,
        });
        return Response.json({
          stage: r.stage, replayed: r.replayed,
          stateVersion: r.commitment.stateVersion,
          reservations: r.commitment.state.reservations,
        }, { status: r.replayed ? 200 : 201 });
      }
      case "record_preparation": {
        const r = await s.commitment.recordPreparation({
          commandKey,
          jobOrderId: String(body.jobOrderId),
          expectedVersion: Number(body.expectedVersion),
          record: {
            reservationId: String(body.reservationId),
            preparationMinutes: Number(body.preparationMinutes ?? 0),
            mobilizationMinutes: Number(body.mobilizationMinutes ?? 0),
            externalCostRefs: asStrings(body.externalCostRefs),
          },
          correlationId, now,
        });
        return Response.json({ stage: r.stage, stateVersion: r.commitment.stateVersion, replayed: r.replayed });
      }
      case "start_work": {
        const r = await s.commitment.startWork({
          commandKey, jobOrderId: String(body.jobOrderId),
          expectedVersion: Number(body.expectedVersion), correlationId, now,
        });
        return Response.json({
          stage: r.stage, stateVersion: r.commitment.stateVersion,
          workStartedAt: r.commitment.workStartedAt, replayed: r.replayed,
        });
      }
      case "cancel": {
        const r = await s.commitment.cancel({
          commandKey,
          jobOrderId: String(body.jobOrderId),
          expectedVersion: Number(body.expectedVersion),
          request: {
            requestId: String(body.requestId ?? commandKey),
            jobOrderId: String(body.jobOrderId),
            cause: body.cause as never,
            requestedAt: now,
            requestedBy: asRequester(body.requestedBy),
            disputed: body.disputed === true,
          },
          // Read from real reservations and accepted assignments, never from
          // the request body. Backfill decides how much money moves, so a
          // caller must not be able to state it.
          ports: await loadCapacityRecovery({
            db: getDatabase(),
            jobOrderId: String(body.jobOrderId),
            candidateSlots: asStrings(body.candidateSlots),
          }),
          correlationId, now,
        });
        return Response.json({
          steps: r.outcome.steps,
          stageAtRequest: r.outcome.snapshot.stage,
          netLostByRole: r.outcome.recovery.netLostByRole,
          netLostTotalMinutes: r.outcome.recovery.netLostTotalMinutes,
          eligibleCosts: r.outcome.instruction.eligibleCosts,
          responsibility: r.outcome.instruction.responsibility,
          chargesFullUnperformedJob: r.outcome.instruction.chargesFullUnperformedJob,
          stateVersion: r.commitment.stateVersion,
        }, { status: 201 });
      }

      // --- L09A -------------------------------------------------------------
      case "open_reality_case": {
        const r = await s.reality.open({
          commandKey,
          realityCaseId: String(body.realityCaseId),
          workCaseId: String(body.workCaseId),
          jobOrderId: String(body.jobOrderId),
          correlationId, now,
        });
        return Response.json({
          realityCaseId: r.stored.realityCase.realityCaseId,
          status: r.stored.realityCase.status,
          stateVersion: r.stored.stateVersion, replayed: r.replayed,
        }, { status: r.replayed ? 200 : 201 });
      }
      case "record_observation": {
        const r = await s.reality.observe({
          commandKey,
          realityCaseId: String(body.realityCaseId),
          expectedVersion: Number(body.expectedVersion),
          observation: {
            observationId: String(body.observationId),
            taskId: String(body.taskId),
            observedAt: now,
            observedBy: String(body.observedBy),
            statement: String(body.statement),
            evidenceRefs: asStrings(body.evidenceRefs),
          },
          changedFacts: asFacts(body.changedFacts, now),
          plannedStatement: String(body.plannedStatement ?? ""),
          correlationId, now,
        });
        const c = r.stored.realityCase.classifications.at(-1);
        return Response.json({
          impact: c?.impact,
          // Never omitted. An unexplained classification is not auditable, and
          // this is the field a customer or a reviewer actually reads.
          rationale: c?.rationale,
          needsHumanReview: c?.needsHumanReview,
          scopeHeld: r.heldNow,
          heldTaskIds: r.stored.realityCase.heldTaskIds,
          stateVersion: r.stored.stateVersion, replayed: r.replayed,
        }, { status: 201 });
      }
      case "decide_recovery": {
        const r = await s.reality.recover({
          commandKey,
          realityCaseId: String(body.realityCaseId),
          expectedVersion: Number(body.expectedVersion),
          allTaskIds: asStrings(body.allTaskIds),
          dependsOn: (body.dependsOn ?? {}) as Record<string, readonly string[]>,
          search: searchFrom(asStrings(body.availableOptions)),
          correlationId, now,
        });
        return Response.json({
          selected: r.decision.selected,
          considered: r.decision.considered,
          routeTo: r.decision.routeTo,
          continuingTaskIds: r.decision.continuingTaskIds,
          unrecoverable: r.decision.unrecoverable,
          needsCustomerApproval: r.decision.needsCustomerApproval,
          stateVersion: r.stored.stateVersion,
        }, { status: 201 });
      }

      // --- L09B -------------------------------------------------------------
      case "settle": {
        const r = await s.settlement.settle({
          commandKey,
          assessmentId: String(body.assessmentId),
          jobOrderId: String(body.jobOrderId),
          realityCaseId: body.realityCaseId ? String(body.realityCaseId) : null,
          cause: body.cause as never,
          customerTest: body.customerTest as never,
          providerTest: body.providerTest as never,
          doneeoTest: body.doneeoTest as never,
          disputed: body.disputed === true,
          evidenceRefs: asStrings(body.evidenceRefs),
          eligibleCosts: (body.eligibleCosts ?? []) as never,
          correlationId, now,
        });
        return Response.json({
          assessmentId: r.assessmentId,
          requiresReview: r.assessment.requiresReview,
          reviewReason: r.assessment.reviewReason,
          reasoning: {
            customer: r.assessment.customer,
            provider: r.assessment.provider,
            doneeo: r.assessment.doneeo,
          },
          // Null when the case went to review. A reviewed case has no
          // allocation, and must not appear to have one.
          instruction: r.instruction && {
            protectedProviderPayable: r.instruction.protectedProviderPayable,
            customerRealityAdjustment: r.instruction.customerRealityAdjustment,
            doneeoAbsorption: r.instruction.doneeoAbsorption,
            allocations: r.instruction.allocations,
            chargesUnperformedWork: r.instruction.chargesUnperformedWork,
          },
          replayed: r.replayed,
        }, { status: 201 });
      }
      default:
        return Response.json({ error: `Unsupported action: ${action || "(none)"}` }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}

/**
 * Invariant violations are 409, not 500.
 *
 * A refused charge, a held scope or a case sent to review is the architecture
 * working, not the server breaking. The invariant name is returned so a caller
 * can tell which rule stopped them.
 */
function fail(error: unknown): Response {
  if (error instanceof CommitmentInvariantError || error instanceof RealityInvariantError ||
      error instanceof FairnessInvariantError) {
    const name = error instanceof FairnessInvariantError ? error.invariant
      : (error as { invariant: string }).invariant;
    return Response.json({ error: error.message, invariant: name }, { status: 409 });
  }
  if (error instanceof CommitmentServiceError || error instanceof RealityServiceError ||
      error instanceof SettlementServiceError) {
    const status = error.code === "STALE_VERSION" || error.code.includes("ALREADY") ? 409 : 422;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "Execution chain unavailable" },
    { status: 500 },
  );
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}
/** Unknown requesters are SYSTEM, never silently attributed to the customer. */
function asRequester(v: unknown): "CUSTOMER" | "PROVIDER" | "DONEEO" | "SYSTEM" {
  const s = String(v ?? "").toUpperCase();
  return s === "CUSTOMER" || s === "PROVIDER" || s === "DONEEO" ? s : "SYSTEM";
}
function asFacts(v: unknown, now: string) {
  return Array.isArray(v)
    ? v.map(x => {
        const f = x as Record<string, unknown>;
        return {
          factKey: String(f.factKey),
          supersededValue: f.supersededValue == null ? null : String(f.supersededValue),
          newValue: String(f.newValue),
          source: (f.source === "CUSTOMER_FIELD_UPDATE" ? "CUSTOMER_FIELD_UPDATE" : "FIELD_OBSERVATION") as
            "FIELD_OBSERVATION" | "CUSTOMER_FIELD_UPDATE",
          evidenceRefs: asStrings(f.evidenceRefs),
          changedAt: typeof f.changedAt === "string" ? f.changedAt : now,
        };
      })
    : [];
}
